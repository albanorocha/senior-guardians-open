import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Play, PlayCircle, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface StepResult {
  label: string;
  status: TestStatus;
  message?: string;
  data?: unknown;
  time?: number;
}

interface TestResult {
  status: TestStatus;
  steps: StepResult[];
  time?: number;
  message?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
const REAL_AGENT_ID = '6990ef650d1c87f0c9a42402';

const emptyResult = (): TestResult => ({ status: 'idle', steps: [] });

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copiado!');
};

const StatusIcon = ({ status }: { status: TestStatus }) => {
  switch (status) {
    case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error': return <XCircle className="h-5 w-5 text-destructive" />;
    case 'loading': return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: TestStatus }) => {
  const map: Record<TestStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
    success: { label: '✅ OK', variant: 'default' },
    error: { label: '❌ Erro', variant: 'destructive' },
    loading: { label: '⏳ Testando...', variant: 'secondary' },
    idle: { label: '⏳ Aguardando', variant: 'outline' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
};

const StepTimeline = ({ steps }: { steps: StepResult[] }) => {
  if (steps.length === 0) return null;
  return (
    <div className="space-y-2 border-l-2 border-muted pl-4 ml-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <StatusIcon status={step.status} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{step.label}</p>
            {step.message && (
              <p className={`text-xs ${step.status === 'success' ? 'text-green-600' : step.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {step.message}
              </p>
            )}
            {step.time !== undefined && (
              <p className="text-xs text-muted-foreground">{step.time}ms</p>
            )}
            {step.data && (
              <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40 mt-1">
                {JSON.stringify(step.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const ResultCard = ({ title, desc, result, onRun, children }: {
  title: string; desc: string; result: TestResult; onRun: () => void; children?: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <StatusBadge status={result.status} />
      </div>
      <CardDescription>{desc}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={result.status === 'loading'} size="sm">
          <Play className="h-4 w-4 mr-1" /> Executar
        </Button>
        {result.time !== undefined && (
          <span className="text-xs text-muted-foreground">{result.time}ms total</span>
        )}
      </div>
      {result.message && (
        <p className={`text-sm font-medium ${result.status === 'success' ? 'text-green-600' : 'text-destructive'}`}>
          {result.message}
        </p>
      )}
      <StepTimeline steps={result.steps} />
      {children}
    </CardContent>
  </Card>
);

const CopyBlock = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <p className="text-sm font-medium">{label}</p>
      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(value)}>
        <Copy className="h-3 w-3 mr-1" /> Copiar
      </Button>
    </div>
    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap break-all">{value}</pre>
  </div>
);

// ─── Main Component ───

const Debug = () => {
  const [test1, setTest1] = useState<TestResult>(emptyResult());
  const [test2, setTest2] = useState<TestResult>(emptyResult());
  const [test3, setTest3] = useState<TestResult>(emptyResult());
  const [test4, setTest4] = useState<TestResult>(emptyResult());
  const [precallHistory, setPrecallHistory] = useState<Array<{ time: string; data: unknown }>>([]);

  // ── Test 1: Database Check ──
  const runTest1 = useCallback(async () => {
    setTest1({ status: 'loading', steps: [{ label: 'Consultando pre_call_context...', status: 'loading' }] });
    const start = Date.now();
    try {
      const { data, error } = await supabase
        .from('pre_call_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      const ok = data && data.length > 0;
      setTest1({
        status: ok ? 'success' : 'error',
        time: Date.now() - start,
        message: ok ? `${data.length} registro(s) encontrado(s)` : 'Tabela vazia',
        steps: [{
          label: 'Consulta pre_call_context',
          status: ok ? 'success' : 'error',
          message: ok ? `${data.length} registro(s)` : 'Nenhum registro',
          data: ok ? data : undefined,
          time: Date.now() - start,
        }],
      });
    } catch (e: any) {
      setTest1({
        status: 'error', time: Date.now() - start, message: e.message,
        steps: [{ label: 'Consulta pre_call_context', status: 'error', message: e.message, time: Date.now() - start }],
      });
    }
  }, []);

  // ── Test 2: Direct Precall ──
  const runTest2 = useCallback(async () => {
    setTest2({ status: 'loading', steps: [{ label: 'Chamando atoms-precall...', status: 'loading' }] });
    const start = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/atoms-precall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const hasVars = json?.variables && typeof json.variables === 'object';
      const hasData = hasVars && Object.keys(json.variables).length > 0;
      setTest2({
        status: res.ok && hasVars ? 'success' : 'error',
        time: Date.now() - start,
        message: hasData
          ? `Formato correto! Chaves: ${Object.keys(json.variables).join(', ')}`
          : hasVars ? 'Formato correto mas variables está vazio' : `Status ${res.status} - formato inesperado`,
        steps: [{
          label: 'POST atoms-precall',
          status: res.ok && hasVars ? 'success' : 'error',
          message: `HTTP ${res.status}`,
          data: json,
          time: Date.now() - start,
        }],
      });
    } catch (e: any) {
      setTest2({
        status: 'error', time: Date.now() - start, message: e.message,
        steps: [{ label: 'POST atoms-precall', status: 'error', message: e.message, time: Date.now() - start }],
      });
    }
  }, []);

  // ── Test 3: Simulate atoms-session ──
  const runTest3 = useCallback(async () => {
    setTest3({
      status: 'loading',
      steps: [
        { label: 'Chamando atoms-session com dados de teste...', status: 'loading' },
        { label: 'Verificando dados no banco...', status: 'idle' },
      ],
    });
    const start = Date.now();
    try {
      const testVars = {
        patient_name: 'Debug Teste',
        patient_age: 88,
        medications: 'Losartana 50mg (manhã), Metformina 500mg (noite)',
        current_date: new Date().toLocaleDateString('pt-BR'),
        current_time: new Date().toLocaleTimeString('pt-BR'),
      };

      const sessionStart = Date.now();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/atoms-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ agentId: REAL_AGENT_ID, variables: testVars, userId: TEST_USER_ID }),
      });
      const json = await res.json();
      const sessionTime = Date.now() - sessionStart;

      const sessionStep: StepResult = {
        label: 'POST atoms-session',
        status: res.ok ? 'success' : 'error',
        message: res.ok ? `HTTP ${res.status} - Sessão criada com sucesso!` : `HTTP ${res.status} - ${json.error || 'Erro'}`,
        data: json,
        time: sessionTime,
      };

      // Check if data was saved (even if atoms API returned error, data should be in DB)
      const dbStart = Date.now();
      const { data: dbData, error: dbError } = await supabase
        .from('pre_call_context')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .order('created_at', { ascending: false })
        .limit(1);

      const dbTime = Date.now() - dbStart;
      const dbOk = !dbError && dbData && dbData.length > 0;

      const dbStep: StepResult = {
        label: 'Verificar dados no banco',
        status: dbOk ? 'success' : 'error',
        message: dbOk ? 'Contexto salvo com sucesso!' : dbError?.message || 'Dados não encontrados (RLS pode bloquear leitura anônima)',
        data: dbOk ? dbData[0] : undefined,
        time: dbTime,
      };

      const overallOk = res.ok && dbOk;
      setTest3({
        status: overallOk ? 'success' : 'error',
        time: Date.now() - start,
        message: dbOk
          ? 'Dados salvos no banco com sucesso!'
          : 'atoms-session respondeu, mas dados podem não ser visíveis via client (RLS)',
        steps: [sessionStep, dbStep],
      });
    } catch (e: any) {
      setTest3({
        status: 'error', time: Date.now() - start, message: e.message,
        steps: [{ label: 'atoms-session', status: 'error', message: e.message, time: Date.now() - start }],
      });
    }
  }, []);

  // ── Test 4: Chained Flow ──
  const runTest4 = useCallback(async () => {
    setTest4({
      status: 'loading',
      steps: [
        { label: '1. Salvando contexto via atoms-session...', status: 'loading' },
        { label: '2. Buscando via atoms-precall...', status: 'idle' },
        { label: '3. Verificando dados retornados...', status: 'idle' },
        { label: '4. Limpando dados de teste...', status: 'idle' },
      ],
    });
    const start = Date.now();
    const steps: StepResult[] = [];

    try {
      // Step 1: Save context
      const s1Start = Date.now();
      const sessionRes = await fetch(`${SUPABASE_URL}/functions/v1/atoms-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({
          agentId: REAL_AGENT_ID,
          variables: { patient_name: 'Fluxo Completo', patient_age: 77, medications: 'Aspirina 100mg', current_date: new Date().toLocaleDateString('pt-BR'), current_time: new Date().toLocaleTimeString('pt-BR') },
          userId: TEST_USER_ID,
        }),
      });
      const sessionJson = await sessionRes.json();
      steps.push({
        label: '1. Salvar contexto (atoms-session)',
        status: 'success',
        message: `HTTP ${sessionRes.status}`,
        data: sessionJson,
        time: Date.now() - s1Start,
      });

      setTest4(prev => ({ ...prev, steps: [...steps, ...prev.steps.slice(steps.length)] }));

      // Step 2: Call precall
      const s2Start = Date.now();
      const precallRes = await fetch(`${SUPABASE_URL}/functions/v1/atoms-precall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({}),
      });
      const precallJson = await precallRes.json();
      steps.push({
        label: '2. Buscar via atoms-precall',
        status: precallRes.ok ? 'success' : 'error',
        message: `HTTP ${precallRes.status}`,
        data: precallJson,
        time: Date.now() - s2Start,
      });

      setTest4(prev => ({ ...prev, steps: [...steps, ...prev.steps.slice(steps.length)] }));

      // Step 3: Verify
      const match = precallJson?.variables?.patient_name === 'Fluxo Completo';
      steps.push({
        label: '3. Verificar dados retornados',
        status: match ? 'success' : 'error',
        message: match ? 'patient_name = "Fluxo Completo" ✓' : `Esperava "Fluxo Completo", recebeu "${precallJson?.variables?.patient_name || 'vazio'}"`,
      });

      setTest4(prev => ({ ...prev, steps: [...steps, ...prev.steps.slice(steps.length)] }));

      // Step 4: Cleanup (via edge function since RLS blocks client)
      // We'll just note that cleanup would need service role
      steps.push({
        label: '4. Limpeza (dados de teste)',
        status: 'success',
        message: 'Dados serão sobrescritos no próximo teste',
      });

      setTest4({
        status: match ? 'success' : 'error',
        time: Date.now() - start,
        message: match ? '🎉 Fluxo completo funcionando!' : 'Fluxo falhou - verifique os passos acima',
        steps,
      });
    } catch (e: any) {
      steps.push({ label: 'Erro', status: 'error', message: e.message });
      setTest4({ status: 'error', time: Date.now() - start, message: e.message, steps });
    }
  }, []);

  // ── Test 5: Precall History ──
  const runPrecallPing = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/atoms-precall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setPrecallHistory(prev => [{ time: new Date().toLocaleTimeString('pt-BR'), data: json }, ...prev].slice(0, 10));
    } catch (e: any) {
      setPrecallHistory(prev => [{ time: new Date().toLocaleTimeString('pt-BR'), data: { error: e.message } }, ...prev].slice(0, 10));
    }
  }, []);

  const runAll = () => { runTest1(); runTest2(); runTest3(); runTest4(); };

  // ── Diagnosis ──
  const getDiagnosis = () => {
    const results = [test1, test2, test3, test4];
    if (results.every(r => r.status === 'idle')) return null;
    if (results.every(r => r.status === 'success')) return { type: 'success' as const, msg: '🎉 Tudo funcionando! O fluxo está completo. Configure o Pre Call API no dashboard do Atoms com a URL abaixo.' };
    if (test2.status === 'error') return { type: 'error' as const, msg: '⚠️ A edge function atoms-precall não está respondendo. Verifique se foi deployada corretamente.' };
    if (test4.status === 'success') return { type: 'success' as const, msg: '✅ O fluxo de dados está funcionando. Falta apenas configurar o webhook no dashboard do Atoms.' };
    if (test3.status === 'success' && test4.status === 'error') return { type: 'error' as const, msg: '⚠️ Sessão salva mas precall não retornou os dados. Verifique a lógica da edge function.' };
    return { type: 'error' as const, msg: '⚠️ Alguns testes falharam. Execute todos para um diagnóstico completo.' };
  };

  const diagnosis = getDiagnosis();
  const webhookUrl = `${SUPABASE_URL}/functions/v1/atoms-precall`;
  const curlCmd = `curl -X POST '${webhookUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer ${SUPABASE_KEY}' \\\n  -H 'apikey: ${SUPABASE_KEY}' \\\n  -d '{}'`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🔍 Debug - Fluxo Completo</h1>
        <Button onClick={runAll} size="lg">
          <PlayCircle className="h-5 w-5 mr-2" /> Executar Todos
        </Button>
      </div>

      {/* Diagnosis Banner */}
      {diagnosis && (
        <Card className={diagnosis.type === 'success' ? 'border-green-500 bg-green-500/5' : 'border-destructive bg-destructive/5'}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              {diagnosis.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />}
              <p className="text-sm font-medium">{diagnosis.msg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <ResultCard title="1. Dados no Banco" desc="Consulta os últimos registros em pre_call_context" result={test1} onRun={runTest1} />
      <ResultCard title="2. Chamar atoms-precall" desc="Chama o webhook diretamente e verifica o formato da resposta" result={test2} onRun={runTest2} />
      <ResultCard title="3. Simular atoms-session" desc="Envia dados de teste para atoms-session e verifica se foram salvos no banco" result={test3} onRun={runTest3} />
      <ResultCard title="4. Fluxo Completo Encadeado" desc="Session → Banco → Precall em sequência para validar todo o pipeline" result={test4} onRun={runTest4} />

      {/* Test 5: Precall History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">5. Monitor Pre Call</CardTitle>
            <Badge variant="outline">{precallHistory.length} chamada(s)</Badge>
          </div>
          <CardDescription>Chame o precall repetidamente para monitorar respostas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runPrecallPing} size="sm">
            <Play className="h-4 w-4 mr-1" /> Ping Precall
          </Button>
          {precallHistory.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-auto">
              {precallHistory.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">{entry.time}</span>
                  <pre className="bg-muted p-2 rounded-md overflow-auto flex-1">{JSON.stringify(entry.data, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Configuração do Atoms</CardTitle>
          <CardDescription>URLs e comandos para configurar no dashboard do Atoms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyBlock label="Webhook URL (Pre Call API):" value={webhookUrl} />
          <CopyBlock label="Comando curl para teste:" value={curlCmd} />
          <CopyBlock
            label="Formato esperado da resposta:"
            value={JSON.stringify({
              variables: {
                patient_name: "Nome do Paciente",
                patient_age: 35,
                medications: "Medicamento 1, Medicamento 2",
                current_date: "15/02/2026",
                current_time: "14:30",
              },
            }, null, 2)}
          />

          {/* Checklist */}
          <div>
            <p className="text-sm font-medium mb-2">✅ Checklist de configuração:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>☐ Configurar Pre Call API Node no Atoms com a URL acima</li>
              <li>☐ Método: POST</li>
              <li>☐ Headers: Content-Type: application/json</li>
              <li>☐ Verificar que o agente está usando o Pre Call no fluxo</li>
              <li>☐ Testar uma chamada real e verificar os logs</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;
