import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import AppNav from '@/components/AppNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Pill } from 'lucide-react';
import { motion } from 'framer-motion';

interface MedForm {
  name: string;
  dosage: string;
  frequency: string;
  time_slots: string;
  instructions: string;
}

const colors = ['bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-indigo-500'];
const shapes = ['rounded-full w-8 h-8', 'rounded-md w-8 h-8', 'rounded-[12px] w-10 h-5']; // circle, square, pill

export const getMedicationStyle = (name: string = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  const shapeClass = shapes[Math.abs(hash >> 3) % shapes.length];
  return { color, shapeClass };
};

const emptyForm: MedForm = { name: '', dosage: '', frequency: 'once daily', time_slots: '08:00', instructions: '' };

const Medications = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const { toast } = useToast();
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchMeds = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase.from('medications').select('*').eq('user_id', effectiveUserId).order('created_at');
    setMeds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMeds(); }, [effectiveUserId]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (med: any) => {
    setEditingId(med.id);
    setForm({ name: med.name, dosage: med.dosage, frequency: med.frequency, time_slots: med.time_slots?.join(', ') || '', instructions: med.instructions || '' });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const slots = form.time_slots.split(',').map(s => s.trim()).filter(Boolean);
    const payload = { user_id: user.id, name: form.name, dosage: form.dosage, frequency: form.frequency, time_slots: slots, instructions: form.instructions || null };

    if (editingId) {
      const { error } = await supabase.from('medications').update(payload).eq('id', editingId);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Medication updated' });
    } else {
      const { error } = await supabase.from('medications').insert(payload);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Medication added' });
    }
    setSubmitting(false);
    setDialogOpen(false);
    fetchMeds();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Medication deleted' }); fetchMeds(); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('medications').update({ active: !active }).eq('id', id);
    fetchMeds();
  };

  if (loading) {
    return (<><AppNav /><main className="container max-w-2xl py-8 px-4 space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></main></>);
  }

  return (
    <>
      <AppNav />
      <main className="container max-w-2xl py-8 px-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <h1 className="text-senior-2xl font-bold flex items-center gap-2">
            <Pill className="h-7 w-7 text-primary" /> Medications
          </h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Medication</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-senior-lg">{editingId ? 'Edit' : 'Add'} Medication</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-senior-sm">Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="h-11" placeholder="Lisinopril" />
                </div>
                <div className="space-y-2">
                  <Label className="text-senior-sm">Dosage</Label>
                  <Input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} required className="h-11" placeholder="10mg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-senior-sm">Frequency</Label>
                  <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once daily">Once daily</SelectItem>
                      <SelectItem value="twice daily">Twice daily</SelectItem>
                      <SelectItem value="three times daily">Three times daily</SelectItem>
                      <SelectItem value="as needed">As needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-senior-sm">Time slots (comma-separated)</Label>
                  <Input value={form.time_slots} onChange={e => setForm({ ...form, time_slots: e.target.value })} required className="h-11" placeholder="08:00, 20:00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-senior-sm">Instructions</Label>
                  <Textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Take with food" />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11">
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Add Medication'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        {meds.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-senior-base text-muted-foreground">No medications yet. Add your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meds.map((med, i) => (
              <motion.div key={med.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`shadow-soft ${!med.active ? 'opacity-60' : ''}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="shrink-0 flex items-center justify-center w-14 h-14 bg-background border rounded-xl shadow-inner">
                      <div className={`shadow-sm border border-black/10 ${getMedicationStyle(med.name).color} ${getMedicationStyle(med.name).shapeClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-senior-base font-semibold">{med.name}</p>
                      <p className="text-senior-sm text-muted-foreground">{med.dosage} · {med.frequency} · {med.time_slots?.join(', ')}</p>
                      {med.instructions && <p className="text-sm text-muted-foreground italic mt-1">{med.instructions}</p>}
                    </div>
                    <div className="flex flex-col items-center gap-1 mx-2">
                      <Switch checked={med.active} onCheckedChange={() => toggleActive(med.id, med.active)} />
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{med.active ? 'On' : 'Off'}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(med)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(med.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default Medications;
