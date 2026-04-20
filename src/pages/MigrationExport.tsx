import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const TABLES = [
  'profiles',
  'user_roles',
  'partner_codes',
  'partner_provision_configs',
  'folders',
  'documents',
  'knowledge_base',
  'messages',
] as const;

const BUCKETS = ['avatars', 'documents', 'knowledge-base', 'chat-attachments'] as const;

// Signed-URL-Lifetime: 30 Tage (ausreichend Puffer für die Migration)
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

type LogKind = 'info' | 'ok' | 'error';
type LogEntry = { time: string; kind: LogKind; msg: string };

type FileEntry = {
  path: string;
  name: string;
  size: number;
  mimetype: string;
};

export default function MigrationExport() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  const addLog = (kind: LogKind, msg: string) => {
    setLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), kind, msg }]);
  };

  const listAllFilesRecursive = async (
    bucket: string,
    path = '',
  ): Promise<FileEntry[]> => {
    const { data: entries, error } = await supabase.storage
      .from(bucket)
      .list(path, { limit: 1000, offset: 0 });

    if (error) throw new Error(`list ${bucket}/${path}: ${error.message}`);
    if (!entries) return [];

    const results: FileEntry[] = [];
    for (const entry of entries) {
      const entryAny = entry as unknown as { id: string | null; name: string; metadata?: { size?: number; mimetype?: string } };
      if (entryAny.id === null) {
        // Ordner → rekursiv
        const sub = await listAllFilesRecursive(
          bucket,
          path ? `${path}/${entryAny.name}` : entryAny.name,
        );
        results.push(...sub);
      } else {
        // Datei
        const fullPath = path ? `${path}/${entryAny.name}` : entryAny.name;
        results.push({
          path: fullPath,
          name: entryAny.name,
          size: entryAny.metadata?.size ?? 0,
          mimetype: entryAny.metadata?.mimetype ?? 'application/octet-stream',
        });
      }
    }
    return results;
  };

  const handleExport = async () => {
    if (!user) return;
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog('info', 'Export gestartet');
    addLog('info', `Source: ${import.meta.env.VITE_SUPABASE_URL as string}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dump: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        exportedBy: { id: user.id, email: user.email, role },
        sourceProjectUrl: import.meta.env.VITE_SUPABASE_URL,
        sourceProjectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
        signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
        tables: {},
        storage: {},
      };

      // === TABELLEN ===
      for (const table of TABLES) {
        addLog('info', `Tabelle laden: ${table}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (supabase.from as any)(table).select('*');
        const { data, error } = await query;
        if (error) {
          addLog('error', `Tabelle ${table}: ${error.message}`);
          throw new Error(`${table}: ${error.message}`);
        }
        dump.tables[table] = data ?? [];
        addLog('ok', `  ${table}: ${(data as unknown[] | null)?.length ?? 0} Zeilen`);
      }

      // === STORAGE ===
      for (const bucket of BUCKETS) {
        addLog('info', `Storage-Bucket: ${bucket} → Dateien listen (rekursiv)`);
        let files: FileEntry[] = [];
        try {
          files = await listAllFilesRecursive(bucket);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          addLog('error', `Bucket ${bucket} list: ${msg}`);
          dump.storage[bucket] = { error: msg, files: [] };
          continue;
        }
        addLog('ok', `  ${bucket}: ${files.length} Dateien gefunden`);

        const entries: Array<{
          path: string;
          size: number;
          mimetype: string;
          signedUrl: string;
        }> = [];

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const { data: sig, error: sigErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(f.path, SIGNED_URL_TTL_SECONDS);

          if (sigErr || !sig?.signedUrl) {
            addLog('error', `Signed-URL ${bucket}/${f.path}: ${sigErr?.message ?? 'leer'}`);
            continue;
          }

          entries.push({
            path: f.path,
            size: f.size,
            mimetype: f.mimetype,
            signedUrl: sig.signedUrl,
          });

          if ((i + 1) % 25 === 0 || i === files.length - 1) {
            addLog('info', `  ${bucket}: ${i + 1}/${files.length} Signed-URLs erzeugt`);
          }
        }

        dump.storage[bucket] = { files: entries };
      }

      // === JSON erzeugen und download triggern ===
      addLog('info', 'JSON serialisieren...');
      const json = JSON.stringify(dump, null, 2);
      const sizeKB = (json.length / 1024).toFixed(1);
      addLog('ok', `JSON-Größe: ${sizeKB} KB`);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `clairmont-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog('ok', `Download gestartet: ${filename}`);
      addLog('ok', '✅ Export abgeschlossen. Datei an Marcus weitergeben.');
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog('error', `Abbruch: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-8">Laden...</div>;
  if (!user) return null;

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">Zugriff verweigert</h1>
          <p className="mt-2 text-muted-foreground">
            Nur Administratoren dürfen den Migrations-Export ausführen.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aktuelle Rolle: {role ?? 'unbekannt'}
          </p>
          <Button className="mt-6" onClick={() => navigate('/')}>
            Zurück zum Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Migrations-Export</h1>
          <p className="text-muted-foreground mt-2">
            Einmaliger Export aller Daten aus dem alten Supabase-Projekt. Läuft lokal mit deiner
            Admin-Session. Das Ergebnis ist ein einzelnes JSON-File, das du an Marcus weitergibst.
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <div>
                <strong>Eingeloggt als:</strong> {user.email}
              </div>
              <div>
                <strong>Rolle:</strong> {role}
              </div>
              <div>
                <strong>Supabase:</strong>{' '}
                <code className="text-xs">{import.meta.env.VITE_SUPABASE_URL as string}</code>
              </div>
            </div>

            <Button onClick={handleExport} disabled={running} size="lg">
              {running ? 'Export läuft...' : done ? 'Nochmal exportieren' : 'Export starten'}
            </Button>
          </div>
        </Card>

        {log.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold mb-3">Log</h2>
            <div className="font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.kind === 'error'
                      ? 'text-red-600'
                      : entry.kind === 'ok'
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                  }
                >
                  [{entry.time}] {entry.msg}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 bg-muted/50">
          <h2 className="font-semibold mb-2">Was exportiert wird</h2>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>
              <strong>8 Datenbank-Tabellen:</strong> profiles, user_roles, partner_codes,
              partner_provision_configs, folders, documents, knowledge_base, messages
            </li>
            <li>
              <strong>4 Storage-Buckets (rekursiv):</strong> avatars, documents, knowledge-base,
              chat-attachments → als Signed-URLs (30 Tage gültig, keine Base64-Bloat)
            </li>
            <li>
              <strong>auth.users wird NICHT exportiert</strong> — dessen Daten sind nicht via
              Client-Zugriff erreichbar. UUIDs der User liegen in <code>profiles.id</code>, Emails
              in <code>profiles.email</code>. Im neuen Supabase werden die User via
              <code> auth.admin.createUser </code>
              mit denselben UUIDs angelegt, Passwörter müssen alle einmal zurückgesetzt werden.
            </li>
            <li>
              <strong>Secrets werden NICHT exportiert</strong> (sind serverseitig, nicht
              Client-zugänglich). Marcus zieht sie separat aus der Lovable-Edge-Function-Config
              oder fragt bei dir nach.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
