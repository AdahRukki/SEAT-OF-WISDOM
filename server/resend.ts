// Resend email integration for contact form notifications
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Send contact form notification to admins
export async function sendContactFormNotification(formData: {
  fullName: string;
  email: string;
  phone?: string;
  inquiryType: string;
  message: string;
  preferredContact?: string;
}) {
  const { client, fromEmail } = await getResendClient();
  
  const adminEmails = ['adahrukki@gmail.com', 'admin@seatofwisdomacademy.com'];
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        New Contact Form Submission
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 150px;">Full Name:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formData.fullName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formData.email}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Phone:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formData.phone || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Inquiry Type:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formData.inquiryType}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Preferred Contact:</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formData.preferredContact || 'Not specified'}</td>
        </tr>
      </table>
      
      <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-radius: 8px;">
        <h3 style="color: #1e3a5f; margin-top: 0;">Message:</h3>
        <p style="line-height: 1.6; color: #374151;">${formData.message}</p>
      </div>
      
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
        This message was sent from the Seat of Wisdom Academy website contact form.
      </p>
    </div>
  `;

  const result = await client.emails.send({
    from: fromEmail || 'noreply@seatofwisdomacademy.com',
    to: adminEmails,
    subject: `New Inquiry: ${formData.inquiryType} - ${formData.fullName}`,
    html: htmlContent,
    replyTo: formData.email
  });

  return result;
}

// Send admissions application notification to admins
export async function sendAdmissionsApplicationNotification(formData: {
  studentName: string;
  dateOfBirth: string;
  gender: string;
  level: string;
  preferredBranch: string;
  previousSchool?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  homeAddress: string;
  specialNeeds?: string;
}) {
  const { client, fromEmail } = await getResendClient();

  const adminEmails = ['adahrukevwe@gmail.com'];

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 180px;">${label}:</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${value || 'Not provided'}</td>
    </tr>`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        New Admissions Application
      </h2>
      <h3 style="color: #1e3a5f; margin-top: 20px;">Student Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${row('Student Name', formData.studentName)}
        ${row('Date of Birth', formData.dateOfBirth)}
        ${row('Gender', formData.gender)}
        ${row('Applying for Level', formData.level)}
        ${row('Preferred Branch', formData.preferredBranch)}
        ${row('Previous School', formData.previousSchool || '')}
      </table>

      <h3 style="color: #1e3a5f; margin-top: 24px;">Parent / Guardian</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${row('Parent Name', formData.parentName)}
        ${row('Phone', formData.parentPhone)}
        ${row('Email', formData.parentEmail || '')}
        ${row('Home Address', formData.homeAddress)}
      </table>

      ${formData.specialNeeds ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-radius: 8px;">
          <h3 style="color: #1e3a5f; margin-top: 0;">Special Needs / Medical:</h3>
          <p style="line-height: 1.6; color: #374151;">${formData.specialNeeds}</p>
        </div>` : ''}

      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
        This application was submitted through the Seat of Wisdom Academy website.
      </p>
    </div>
  `;

  const result = await client.emails.send({
    from: fromEmail || 'noreply@seatofwisdomacademy.com',
    to: adminEmails,
    subject: `New Application: ${formData.studentName} - ${formData.level}`,
    html: htmlContent,
    replyTo: formData.parentEmail || undefined,
  });

  return result;
}
