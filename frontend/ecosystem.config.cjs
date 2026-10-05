module.exports = {
  apps: [
    {
      name: 'sis-fe',
      script: 'yarn preview --port 8006 --host 0.0.0.0',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
