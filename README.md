# Sistema de Chamados de TI (HelpDesk TI) — Firebase Auth + RBAC

- **Aluno:** Davi Augusto Lopes Campos
- **Aplicação em Produção (Render):** https://chamados-ti-fjkn.onrender.com

## Credenciais de Teste

| Perfil | E-mail | Senha | Permissões Validadas |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@teste.com` | `123456` | Gestão de perfis RBAC, visualização total, atendimento e exclusão |
| **Técnico** | `tecnico@teste.com` | `123456` | Visualiza todos os chamados, assume atendimento e altera status/parecer |
| **User** | `user@teste.com` | `123456` | Abre chamados e visualiza exclusivamente os próprios registros |

Sistema web para abertura, acompanhamento e organização de chamados de TI, construído no padrão **MVC** com **Node.js, Express, EJS, CSS e Sequelize** (SQLite), integrado com **Firebase Authentication** e **Cloud Firestore** para controle de acesso baseado em papéis (RBAC).

## Como rodar

```bash
npm install
npm start        # http://localhost:3000
