export const errorHandler = (err, req, res, next) => {
  console.error('❌ خطأ:', err.stack);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }

  if (err.code === 11000) {
    return res.status(400).json({ error: 'البيانات موجودة مسبقاً.' });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'حدث خطأ في السيرفر. حاول لاحقاً.',
  });
};
