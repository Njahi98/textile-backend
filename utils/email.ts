import nodemailer from 'nodemailer';
import { CustomError } from '../middleware/errorHandler';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GOOGLE_APP_USER,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    await transporter.sendMail({
      from: process.env.GOOGLE_APP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    const customError = new Error('Failed to send email') as CustomError;
    customError.statusCode = 500;
    customError.message = 'Unable to send email. Please try again later.';
    throw customError;
  }
};
