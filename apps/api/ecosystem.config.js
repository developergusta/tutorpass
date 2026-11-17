// PM2 — VPS: pm2 start apps/api/ecosystem.config.js --env production
module.exports = { apps: [{ name: 'tutorpass-api', script: 'dist/main.js', cwd: __dirname,
  instances: 1, // >1 só com Redis Adapter ativo e sessão stateless (já previsto)
  exec_mode: 'fork', max_memory_restart: '512M', autorestart: true,
  env: { NODE_ENV: 'development' }, env_production: { NODE_ENV: 'production', PORT: 3333 },
  out_file: './logs/out.log', error_file: './logs/error.log', time: true }] };
