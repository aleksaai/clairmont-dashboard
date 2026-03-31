import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calculator, Euro, Users, TrendingUp, Calendar, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProvisionConfig {
  id: string;
  partner_code: string;
  provision_type: 'fixed' | 'percentage';
  provision_value: number;
  bookkeeper_fee: number;
}

function getMonthOptions() {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: de }),
    });
  }
  return options;
}

export function ProvisionsrechnerView() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const isVertriebler = role === 'vertriebler';
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ProvisionConfig | null>(null);
  const [formData, setFormData] = useState({
    partner_code: '',
    provision_type: 'percentage' as 'fixed' | 'percentage',
    provision_value: 0,
    bookkeeper_fee: 130,
  });
  
  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);

  // Fetch provision configs from database
  const { data: provisionConfigs, isLoading: configsLoading } = useQuery({
    queryKey: ['provision-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_provision_configs')
        .select('*')
        .order('partner_code');
      
      if (error) throw error;
      return data as ProvisionConfig[];
    },
  });

  // Fetch all paid folders for the selected month
  const { data: paidFolders, isLoading: foldersLoading } = useQuery({
    queryKey: ['paid-folders-provisions', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, customer_name, partner_code, prognose_amount, updated_at, status')
        .eq('status', 'bezahlt')
        .not('partner_code', 'is', null)
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create config lookup map
  const configMap = useMemo(() => {
    const map: Record<string, ProvisionConfig> = {};
    provisionConfigs?.forEach(c => {
      map[c.partner_code.toUpperCase()] = c;
    });
    return map;
  }, [provisionConfigs]);

  // Calculate provision based on config
  const calculateProvision = (partnerCode: string, amount: number): number => {
    const config = configMap[partnerCode.toUpperCase()];
    if (!config) {
      // Fallback to default if exists
      const defaultConfig = configMap['DEFAULT'];
      if (defaultConfig) {
        if (defaultConfig.provision_type === 'percentage') {
          return amount * (defaultConfig.provision_value / 100);
        }
        return defaultConfig.provision_value;
      }
      return 0;
    }
    
    if (config.provision_type === 'percentage') {
      return amount * (config.provision_value / 100);
    }
    return config.provision_value;
  };

  // Get bookkeeper fee for a partner code
  const getBookkeeperFee = (partnerCode: string): number => {
    const config = configMap[partnerCode.toUpperCase()];
    if (!config) {
      const defaultConfig = configMap['DEFAULT'];
      return defaultConfig?.bookkeeper_fee || 130;
    }
    return config.bookkeeper_fee;
  };

  // Mutations
  const createConfigMutation = useMutation({
    mutationFn: async (data: Omit<ProvisionConfig, 'id'>) => {
      const { error } = await supabase
        .from('partner_provision_configs')
        .insert({
          partner_code: data.partner_code.toUpperCase(),
          provision_type: data.provision_type,
          provision_value: data.provision_value,
          bookkeeper_fee: data.bookkeeper_fee,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provision-configs'] });
      toast.success('Provisionskonfiguration erstellt');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: ProvisionConfig) => {
      const { error } = await supabase
        .from('partner_provision_configs')
        .update({
          partner_code: data.partner_code.toUpperCase(),
          provision_type: data.provision_type,
          provision_value: data.provision_value,
          bookkeeper_fee: data.bookkeeper_fee,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provision-configs'] });
      toast.success('Provisionskonfiguration aktualisiert');
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partner_provision_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provision-configs'] });
      toast.success('Provisionskonfiguration gelöscht');
    },
    onError: (error: Error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const openCreateDialog = () => {
    setEditingConfig(null);
    setFormData({
      partner_code: '',
      provision_type: 'percentage',
      provision_value: 0,
      bookkeeper_fee: 130,
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (config: ProvisionConfig) => {
    setEditingConfig(config);
    setFormData({
      partner_code: config.partner_code,
      provision_type: config.provision_type,
      provision_value: config.provision_value,
      bookkeeper_fee: config.bookkeeper_fee,
    });
    setEditDialogOpen(true);
  };

  const closeDialog = () => {
    setEditDialogOpen(false);
    setEditingConfig(null);
  };

  const handleSubmit = () => {
    if (!formData.partner_code.trim()) {
      toast.error('Bitte Partnercode eingeben');
      return;
    }

    if (editingConfig) {
      updateConfigMutation.mutate({
        id: editingConfig.id,
        ...formData,
      });
    } else {
      createConfigMutation.mutate(formData);
    }
  };

  const handleDelete = (config: ProvisionConfig) => {
    if (confirm(`Möchtest du die Konfiguration für "${config.partner_code}" wirklich löschen?`)) {
      deleteConfigMutation.mutate(config.id);
    }
  };

  // Calculate provisions grouped by partner code
  const provisionsByPartner = useMemo(() => {
    if (!paidFolders) return [];
    
    const grouped: Record<string, { 
      partnerCode: string; 
      totalProvision: number; 
      totalAmount: number;
      totalBookkeeper: number;
      folderCount: number;
      folders: typeof paidFolders;
    }> = {};

    paidFolders.forEach(folder => {
      const code = folder.partner_code?.toUpperCase();
      if (!code) return;
      
      const rawAmount = folder.prognose_amount || 0;
      const amount = rawAmount * 0.3; // 30% Beratungsgebühr = unser Umsatz
      const provision = calculateProvision(code, amount);
      const bookkeeper = getBookkeeperFee(code);
      
      if (!grouped[code]) {
        grouped[code] = {
          partnerCode: code,
          totalProvision: 0,
          totalAmount: 0,
          totalBookkeeper: 0,
          folderCount: 0,
          folders: [],
        };
      }
      
      grouped[code].totalProvision += provision;
      grouped[code].totalAmount += amount;
      grouped[code].totalBookkeeper += bookkeeper;
      grouped[code].folderCount += 1;
      grouped[code].folders.push(folder);
    });

    return Object.values(grouped).sort((a, b) => b.totalProvision - a.totalProvision);
  }, [paidFolders, configMap]);

  // Calculate totals
  const totals = useMemo(() => {
    return provisionsByPartner.reduce(
      (acc, p) => ({
        totalProvisions: acc.totalProvisions + p.totalProvision,
        totalAmount: acc.totalAmount + p.totalAmount,
        totalFolders: acc.totalFolders + p.folderCount,
        totalBookkeeper: acc.totalBookkeeper + p.totalBookkeeper,
      }),
      { totalProvisions: 0, totalAmount: 0, totalFolders: 0, totalBookkeeper: 0 }
    );
  }, [provisionsByPartner]);

  const monthOptions = getMonthOptions();
  const isLoading = configsLoading || foldersLoading;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calculator className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Provisionsübersicht</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                <Euro className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Umsatz (30% Gebühr)</p>
                <p className="text-lg md:text-2xl font-bold text-foreground">{totals.totalAmount.toFixed(0)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Provisionen</p>
                <p className="text-lg md:text-2xl font-bold text-foreground">{totals.totalProvisions.toFixed(0)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-muted rounded-lg">
                <Euro className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Sachbearbeiter</p>
                <p className="text-lg md:text-2xl font-bold text-foreground">{totals.totalBookkeeper.toFixed(0)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-muted rounded-lg">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Kunden</p>
                <p className="text-lg md:text-2xl font-bold text-foreground">{totals.totalFolders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provisionen nach Partner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provisionen nach Partnercode</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : provisionsByPartner.length === 0 ? (
            <p className="text-muted-foreground">Keine bezahlten Ordner mit Partnercode in diesem Monat.</p>
          ) : (
            <div className="space-y-4">
              {provisionsByPartner.map(partner => {
                const config = configMap[partner.partnerCode];
                return (
                  <div key={partner.partnerCode} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {partner.partnerCode.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{partner.partnerCode}</p>
                          <p className="text-sm text-muted-foreground">
                            {config?.provision_type === 'percentage' 
                              ? `${config.provision_value}% Provision` 
                              : config?.provision_type === 'fixed'
                                ? `${config.provision_value}€ Fix`
                                : 'Standard-Provision'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">
                          {partner.totalProvision.toFixed(2)} €
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {partner.folderCount} {partner.folderCount === 1 ? 'Kunde' : 'Kunden'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Details der Kunden */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Kunden:</p>
                      <div className="space-y-1">
                        {partner.folders.map(folder => (
                          <div key={folder.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{folder.customer_name}</span>
                            <div className="flex gap-4">
                              <span className="text-muted-foreground">
                                {((folder.prognose_amount || 0) * 0.3).toFixed(2)} € Gebühr
                              </span>
                              <span className="text-primary font-medium">
                                → {calculateProvision(partner.partnerCode, (folder.prognose_amount || 0) * 0.3).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provisionsübersicht alle Partner */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Provisionsübersicht alle Partner</CardTitle>
          {isAdmin && (
            <Button onClick={openCreateDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Neu
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Typ</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Provision</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Sachbearbeiter</th>
                    {isAdmin && (
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Aktionen</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {provisionConfigs?.map(config => (
                    <tr key={config.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium text-foreground">{config.partner_code}</td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {config.provision_type === 'percentage' ? 'Prozent' : 'Fix'}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {config.provision_type === 'percentage' 
                          ? `${config.provision_value}%` 
                          : `${config.provision_value}€`}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {config.bookkeeper_fee}€
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(config)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(config)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Provisionskonfiguration bearbeiten' : 'Neue Provisionskonfiguration'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Partnercode</label>
              <Input
                value={formData.partner_code}
                onChange={(e) => setFormData({ ...formData, partner_code: e.target.value })}
                placeholder="z.B. AB-CD"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Provisionstyp</label>
              <Select
                value={formData.provision_type}
                onValueChange={(v) => setFormData({ ...formData, provision_type: v as 'fixed' | 'percentage' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Prozent (%)</SelectItem>
                  <SelectItem value="fixed">Fix (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {formData.provision_type === 'percentage' ? 'Provision (%)' : 'Provision (€)'}
              </label>
              <Input
                type="number"
                value={formData.provision_value}
                onChange={(e) => setFormData({ ...formData, provision_value: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Sachbearbeitergebühr (€)</label>
              <Input
                type="number"
                value={formData.bookkeeper_fee}
                onChange={(e) => setFormData({ ...formData, bookkeeper_fee: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createConfigMutation.isPending || updateConfigMutation.isPending}
            >
              {editingConfig ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
