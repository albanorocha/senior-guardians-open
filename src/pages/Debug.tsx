import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface TestResult {
  status: TestStatus;
  data?: unknown;
  error?: string;
  time?: number;
  message?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Debug = () => {
  const [test1, setTest1] = useState<TestResult>({ status: 'idle' });
  const [test2, setTest2] = useState<TestResult>({ status: 'idle' });
  const [test3, setTest3] = useState<TestResult>({ status: 'idle' });

  const statusColor = (s: TestStatus) =>
    s === 'success' ? 'default' : s === 'error' ? 'destructive' : s === 'loading' ? 'secondary' : 'outline';

  const runTest1 = async () => {
    setTest1({ status: 'loading' });
    const start = Date.now();
    try {
      const { data, error } = await supabase
        .from('pre_call_context')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setTest1({
        status: data && data.length > 0 ? 'success' : 'error',
        data,
        time: Date.now() - start,
        message: data && data.length > 0 ? `${data.length} registro(s) encontrado(s)` : 'Nenhum registro na tabela',
      });
    } catch (e: any) {
      setTest1({ status: 'error', error: e.message, time: Date.now() - start, message: 'Erro ao consultar banco' });
    }
  };

  const runTest2 = async () => {
    setTest2({ status: 'loading' });
    const start = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/atoms-precall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const hasVariables = json?.variables && typeof json.variables === 'object';
      setTest2({
        status: res.ok && hasVariables ? 'success' : 'error',
        data: json,
        time: Date.now() - start,
        message: hasVariables
          ? `Formato correto! Chaves: ${Object.keys(json.variables).join(', ')}`
          : `Status ${res.status} - formato inesperado`,
      });
    } catch (e: any) {
      setTest2({ status: 'error', error: e.message, time: Date.now() - start, message: 'Falha ao chamar atoms-precall' });
    }
  };

  const runTest3 = async () => {
    setTest3({ status: 'loading' });
    const start = Date.now();
    try {
      // Insert test data directly
      const testUserId = '00000000-0000-0000-0000-000000000001';
      await supabase.from('pre_call_context').delete().eq('user_id', testUserId);
      const { error: insertErr } = await supabase.from('pre_call_context').insert({
        user_id: testUserId,
        variables: {
          patient_name: 'Teste Debug',
          patient_age: 99,
          medications: 'Paracetamol 500mg (manhã)',
          current_date: new Date().toLocaleDateString('pt-BR'),
          current_time: new Date().toLocaleTimeString('pt-BR'),
        },
      });
      if (insertErr) throw new Error(`Insert falhou: ${insertErr.message}`);

      // Now call precall
      const res = await fetch(`${SUPABASE_URL}/functions/v1/atoms-precall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      const ok = json?.variables?.patient_name === 'Teste Debug';

      // Cleanup
      await supabase.from('pre_call_context').delete().eq('user_id', testUserId);

      setTest3({
        status: ok ? 'success' : 'error',
        data: { insert: 'ok', precall_response: json },
        time: Date.now() - start,
        message: ok ? 'Fluxo completo funcionando!' : 'Dados inseridos mas precall não retornou corretamente',
      });
    } catch (e: any) {
      setTest3({ status: 'error', error: e.message, time: Date.now() - start, message: 'Erro no fluxo simulado' });
    }
  };

  const runAll = () => {
    runTest1();
    runTest2();
    runTest3();
  };

  const webhookUrl = `${SUPABASE_URL}/functions/v1/atoms-precall`;
  const curlCmd = `curl -X POST '${webhookUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer ${SUPABASE_KEY}' \\\n  -H 'apikey: ${SUPABASE_KEY}' \\\n  -d '{}'`;

  const ResultCard = ({ title, desc, result, onRun }: { title: string; desc: string; result: TestResult; onRun: () => void }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant={statusColor(result.status)}>
            {result.status === 'idle' ? '⏳ Aguardando' : result.status === 'loading' ? '⏳ Testando...' : result.status === 'success' ? '✅ OK' : '❌ Erro'}
          </Badge>
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onRun} disabled={result.status === 'loading'} size="sm">
          Executar
        </Button>
        {result.time !== undefined && (
          <p className="text-xs text-muted-foreground">{result.time}ms</p>
        )}
        {result.message && (
          <p className={`text-sm font-medium ${result.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {result.message}
          </p>
        )}
        {(result.data || result.error) && (
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
            {JSON.stringify(result.data || result.error, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🔍 Debug - Fluxo Pre Call</h1>
        <Button onClick={runAll}>Executar Todos</Button>
      </div>

      <ResultCard title="1. Dados no Banco" desc="Verifica os últimos registros em pre_call_context" result={test1} onRun={runTest1} />
      <ResultCard title="2. Chamar atoms-precall" desc="Testa a edge function diretamente do browser" result={test2} onRun={runTest2} />
      <ResultCard title="3. Fluxo Completo" desc="Insere dados de teste e verifica se precall retorna" result={test3} onRun={runTest3} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Informações para Configuração</CardTitle>
          <CardDescription>URL e comandos para configurar no dashboard do Atoms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Webhook URL (Pre Call API):</p>
            <pre className="text-xs bg-muted p-3 rounded-md break-all">{webhookUrl}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Comando curl para teste:</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap">{curlCmd}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Formato esperado da resposta:</p>
            <pre className="text-xs bg-muted p-3 rounded-md">
{JSON.stringify({
  variables: {
    patient_name: "Nome do Paciente",
    patient_age: 35,
    medications: "Medicamento 1, Medicamento 2",
    current_date: "15/02/2026",
    current_time: "14:30",
  },
}, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;
