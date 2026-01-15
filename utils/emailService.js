import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, use services like SendGrid, Mailgun, or AWS SES
  
  // Using Gmail as default (requires app password)
  // For other services, update the configuration accordingly
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user:'ahmed@audienta.ai',
      pass: 'gmnq stzx lyxe nrxn', // Use app password for Gmail
    },
    // For other SMTP services, use:
    // host: process.env.SMTP_HOST,
    // port: process.env.SMTP_PORT,
    // secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  });
};

/**
 * Send board invitation email
 */
export const sendBoardInvitation = async (toEmail, userName, inviterName, boardTitle, workspaceName, boardUrl) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('Email service not configured. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"${inviterName}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `You've been invited to join "${boardTitle}" board`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9fafb;
              border-radius: 8px;
              padding: 30px;
              border: 1px solid #e5e7eb;
            }
            .header {
              background-color: #4f46e5;
              color: white;
              padding: 20px;
              border-radius: 8px 8px 0 0;
              margin: -30px -30px 20px -30px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4f46e5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Board Invitation</h1>
            </div>
            <h2>Hello ${userName},</h2>
            <p>
              <strong>${inviterName}</strong> has invited you to join the board 
              <strong>"${boardTitle}"</strong>
              ${workspaceName ? `in the workspace "${workspaceName}"` : ''}.
            </p>
            <p>
              You can now view and work on tasks in this board. Click the button below to access the board:
            </p>
            ${boardUrl ? `
              <a href="${boardUrl}" class="button">View Board</a>
            ` : ''}
            <p>
              If you have any questions, feel free to reach out to ${inviterName}.
            </p>
            <div class="footer">
              <p>This is an automated email from Kanban Board. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${userName},
        
        ${inviterName} has invited you to join the board "${boardTitle}"${workspaceName ? ` in the workspace "${workspaceName}"` : ''}.
        
        You can now view and work on tasks in this board.
        ${boardUrl ? `Access the board at: ${boardUrl}` : ''}
        
        If you have any questions, feel free to reach out to ${inviterName}.
        
        This is an automated email from Kanban Board.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send user invitation email (for registration/login)
 * @param {string} toEmail - Email address to send invitation to
 * @param {string} inviterName - Name of the person sending the invitation
 * @param {string} acceptanceUrl - URL to accept the invitation (with token)
 * @param {string} loginUrl - URL to login page
 * @param {string} registerUrl - URL to register page (with invite token)
 * @param {string} action - 'login' or 'register' (for display purposes)
 * @param {string} invitationToken - Invitation token for verification
 */
export const sendUserInvitation = async (toEmail, inviterName, inviterEmail, loginUrl, registerUrl, action = 'register', invitationToken = null) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('Email service not configured. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    // Primary action URL - Register for new users, Login for existing
    const primaryUrl = action === 'register' ? registerUrl : loginUrl;

    // console.log('Inviter info:', { inviterName, inviterEmail, loginUrl, registerUrl, action, invitationToken });

    const mailOptions = {
      from: `"Kanban Board" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `You're invited to join ${inviterName}'s team on Kanban Board`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
                  
                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center;">
                            <div style="display: inline-block; background-color: #3b82f6; padding: 12px 16px; border-radius: 10px;">
                              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">📋 Kanban</span>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Main Content -->
                  <tr>
                    <td style="background-color: #ffffff; padding: 48px 40px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        
                        <!-- Welcome Title -->
                        <tr>
                          <td style="padding-bottom: 8px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b; line-height: 1.3;">
                              Welcome to Kanban Board!
                            </h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #475569; line-height: 1.4;">
                              Accept your invitation to get started.
                            </h2>
                          </td>
                        </tr>
                        
                        <!-- Invitation Message -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
                             <strong style="color: #1e293b;">
                                ${inviterName.charAt(0).toUpperCase() + inviterName.slice(1)} <span style="color: #64748b;">(${inviterEmail})</span> 
                             </strong>
                              has invited you to join their team as part of ${inviterName}'s organization's workspace.
                            </p>
                          </td>
                           
                        </tr>
                        
                        <!-- CTA Text -->
                        <tr>
                          <td style="padding-bottom: 24px;">
                            <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
                              Please click below to get started.
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Primary CTA Button -->
                        <tr>
                          <td style="padding-bottom: 40px; text-align: center;">
                            <a href="${primaryUrl}" 
                               style="display: inline-block; 
                                      background-color: #f97316; 
                                      color: #ffffff; 
                                      font-size: 16px; 
                                      font-weight: 600; 
                                      text-decoration: none; 
                                      padding: 16px 48px; 
                                      border-radius: 8px;
                                      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                              ${action === 'register' ? 'Join Team' : 'Join Team'}
                            </a>
                          </td>
                        </tr>
                        
                        <!-- Divider -->
                        <tr>
                          <td style="padding-bottom: 32px;">
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">
                          </td>
                        </tr>
                        
                        <!-- Sign off -->
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px 0; font-size: 16px; color: #334155;">Thanks,</p>
                            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">The Kanban Board team</p>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 32px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        
                        <!-- Alternative Link -->
                        <tr>
                          <td style="padding-bottom: 20px;">
                            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                              You can also copy and paste this link into your browser:
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 12px; word-break: break-all;">
                              <a href="${primaryUrl}" style="color: #3b82f6; text-decoration: none;">${primaryUrl}</a>
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Ignore Notice -->
                        <tr>
                          <td style="padding-bottom: 20px;">
                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              You may ignore this email if you do not want to join the team. This invitation will expire in 7 days.
                            </p>
                          </td>
                        </tr>
                        
                        <!-- Copyright -->
                        <tr>
                          <td>
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                              © ${new Date().getFullYear()} Kanban Board. All rights reserved.
                            </p>
                          </td>
                        </tr>
                        
                      </table>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Welcome to Kanban Board!
Accept your invitation to get started.

${inviterName} has invited you to join their team as part of your organization's workspace.

Please click the link below to get started:
${primaryUrl}

Thanks,
The Kanban Board team

---
You may ignore this email if you do not want to join the team. This invitation will expire in 7 days.

© ${new Date().getFullYear()} Kanban Board. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Invitation email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return { success: false, error: error.message };
  }
};

