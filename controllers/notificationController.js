import Notification from '../models/notification.mode.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { title, body, link, data } = req.body;
    const notification = await Notification.create({ 
      userId: req.user.id, 
      title, 
      body, 
      link: link || '/', 
      data: data || {} 
    });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};