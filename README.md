# 🏃 workout-controller

Aplicação em TypeScript (Node.js) estruturada para rodar continuamente em background como serviço de gestão de treinos e reconciliação para múltiplos atletas (Daniel e Patrícia), com persistência em SQLite local (`better-sqlite3`), disparos diários via WhatsApp (Evolution API) e sincronização com Intervals.icu.

---

## 🛠️ Stack Tecnológica

- **Linguagem & Runtime:** Node.js + TypeScript (`tsc` e `ts-node`)
- **Banco de Dados:** SQLite local (`workouts.db`) via `better-sqlite3` com WAL mode ativado
- **Agendamento:** `node-cron`
- **Requisições HTTP:** `axios`
- **Integração WhatsApp:** Evolution API (`POST /message/sendText/{instance}`)
- **Integração Treinos:** Intervals.icu API (`/athlete/{id}/activities` com Basic Auth)
- **Interface de Gestão:** CLI interativo via readline (`npm run setup`)

---

## 📂 Estrutura do Banco de Dados

- **`athletes`**: Perfis dos atletas com ID fixo (`daniel`, `patricia`, etc.), nome, telefone WhatsApp com DDI/DDD, credenciais Intervals.icu e horário de notificação matinal.
- **`races`**: Cadastro de provas-alvo com prioridades (`P1`, `P2`, `P3`), distância e tempo alvo.
- **`scheduled_workouts`**: Prescrições diárias de treinos detalhadas por modalidade (foco, KM, rua, esteira, musculação, bike e notas clínicas) e flag de envio (`whatsapp_sent`).
- **`completed_activities`**: Reconciliação dos treinos reais importados do Intervals.icu (distância, tempo em movimento, pace médio, FC média, RPE e carga interna/load).

---

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Verifique o arquivo `.env` gerado na raiz:
```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=workouts.db

# Evolution API
EVOLUTION_BASE_URL=https://whatsapp-ecostone.onrender.com
EVOLUTION_INSTANCE_NAME=ecostone
EVOLUTION_API_KEY=Gabriel2006!

# Configurações Iniciais dos Atletas
DANIEL_PHONE=5511988139833
DANIEL_INTERVALS_ID=i753639
DANIEL_INTERVALS_KEY=2uarr3hetzp8m8qw70b2q2ekc

PATRICIA_PHONE=5511988136702
PATRICIA_INTERVALS_ID=
PATRICIA_INTERVALS_KEY=
```

### 3. Interface CLI de Gestão
Para cadastrar/atualizar atletas, agendar treinos manualmente, testar envios do WhatsApp ou executar as rotinas cron imediatamente:
```bash
npm run setup
```

### 4. Execução em Desenvolvimento (Background / Daemon)
```bash
npm run dev
```

### 5. Compilação e Produção
```bash
npm run build
npm start
```

---

## ⏰ Rotinas Automáticas (Cron Jobs)

1. **Lembrete Matinal (WhatsApp):**
   - Disparo diário às **06:30** (ou no `notify_time` customizado do atleta).
   - Busca treinos em `scheduled_workouts` para a data atual com `whatsapp_sent = 0`.
   - Formata a mensagem com Foco, Volume (KM), Opção Rua, Opção Esteira, Musculação, Bike e Recomendações Clínicas.
   - Atualiza `whatsapp_sent = 1` após envio com sucesso.

2. **Reconciliação Noturna (Intervals.icu):**
   - Disparo diário às **22:00**.
   - Consulta atividades do dia diretamente na API do Intervals.icu.
   - Salva e atualiza os dados em `completed_activities`.
   - Envia um resumo formatado de feedback no WhatsApp de cada atleta com volume, duração, pace médio, frequência cardíaca média e carga interna de treino.
