module.exports = (req, res) => {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  
  res.status(200).json({
    hasToken: !!token,
    hasGH_TOKEN: !!process.env.GH_TOKEN,
    hasGITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
    tokenLength: token ? token.length : 0,
    tokenStart: token ? token.substring(0, 4) + '...' : 'missing',
    allEnvVars: Object.keys(process.env).sort()
  });
};
