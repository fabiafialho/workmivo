# Workmivo
MVP de gestão de serviços, multilíngue (Español / English / Português).

## Publicar
1. Suba os arquivos da pasta raiz deste projeto para a raiz do repositório GitHub `workmivo` (não envie apenas o ZIP).
2. Na Vercel, conecte o repositório e configure **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL do seu projeto Supabase (sem `/rest/v1/`).
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = chave pública do Supabase.
3. Faça Deploy / Redeploy.
4. Em Supabase > Authentication > URL Configuration, configure **Site URL** para `https://SEU-PROJETO.vercel.app` e adicione essa URL aos redirects.
5. Confirme que executou o SQL inicial contendo `companies`, `company_members`, `customers`, `estimates`, `jobs`, `invoices`, `subscriptions` e a função `create_my_company`.

## Limites nesta versão
- Login, cadastro e recuperação de senha via Supabase Auth.
- Novo espaço de empresa, dashboard e CRUD de clientes, orçamentos, serviços e faturas.
- Idiomas ES/EN/PT com preferências salvas neste dispositivo.
- Ainda NÃO há envio de orçamento por email, aprovação online, Hotmart nem aplicação de limites de planos.
- O aplicativo não deve ser colocado à venda até integrar pagamentos, proteger regras comerciais no backend e testar o fluxo completo.
