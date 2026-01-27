import admin from '../firebaseAdmin.js';

export const sendNotification = async (req, res) => {
  try {
    const { token, title, body } = req.body;

     // Debug logs to check token
     console.log("token type:", typeof token);
     console.log("token length:", token?.length);
     console.log("token preview:", token?.slice(0, 20));
     console.log("full token:", token);

    if (!token || !title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields: token, title, body' 
      });
    }

    const message = {
      token,
      notification: {
        title,
        body,
      },
    };

    console.log("sending token len:", token.length);
console.log("sending token preview:", token.slice(0, 30));

    const response = await admin.messaging().send(message);

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      messageId: response 
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
};