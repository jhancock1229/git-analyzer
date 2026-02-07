export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const token = process.env.GITHUB_TOKEN;
  
  return res.status(200).json({
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenStart: token ? token.substring(0, 4) + '...' : 'missing',
    allEnvVars: Object.keys(process.env).sort()
  });
}
