"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.sendVerificationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
// 🔑 SMTP credentials (SMTP_HOST / SMTP_USER / SMTP_PASS) come from your .env via src/config/env.ts
const transporter = env_1.env.SMTP_HOST
    ? nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_SECURE, // true for 465, false for 587 (STARTTLS)
        auth: env_1.env.SMTP_USER ? { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } : undefined,
    })
    : null;
async function send(mail) {
    if (!transporter) {
        // Development fallback: no SMTP configured -> print the email in the terminal
        console.log(`\n📧 [DEV EMAIL] to: ${mail.to}\n   subject: ${mail.subject}\n   ${mail.text}\n`);
        return;
    }
    await transporter.sendMail({ from: env_1.env.MAIL_FROM, ...mail });
}
const layout = (title, intro, code) => `
<div style="font-family:Inter,Arial,sans-serif;background:#f5f3ff;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;text-align:center">
    <h2 style="margin:0 0 8px;color:#111827">${title}</h2>
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px">${intro}</p>
    <div style="display:inline-block;letter-spacing:10px;font-size:34px;font-weight:800;color:#6d28d9;background:#ede9fe;border-radius:12px;padding:14px 22px">${code}</div>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px">This code expires in ${env_1.env.CODE_EXPIRES_MINUTES} minutes. If you didn't request it, you can safely ignore this email.</p>
  </div>
</div>`;
const sendVerificationEmail = (to, name, code) => send({
    to,
    subject: `${code} is your MiniBook verification code`,
    text: `Hi ${name}, your MiniBook verification code is ${code}. It expires in ${env_1.env.CODE_EXPIRES_MINUTES} minutes.`,
    html: layout("Verify your email", `Hi ${name}, enter this code to finish creating your MiniBook account.`, code),
});
exports.sendVerificationEmail = sendVerificationEmail;
const sendPasswordResetEmail = (to, name, code) => send({
    to,
    subject: `${code} is your MiniBook password reset code`,
    text: `Hi ${name}, your MiniBook password reset code is ${code}. It expires in ${env_1.env.CODE_EXPIRES_MINUTES} minutes.`,
    html: layout("Reset your password", `Hi ${name}, use this code to choose a new password.`, code),
});
exports.sendPasswordResetEmail = sendPasswordResetEmail;
//# sourceMappingURL=mailer.js.map