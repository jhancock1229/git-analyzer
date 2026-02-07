module.exports = (req, res) => {
  res.status(200).json({ 
    message: 'Hello from Vercel',
    hasToken: !!process.env.GITHUB_TOKEN,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  });
};
