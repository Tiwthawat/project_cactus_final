// routes/upload.ts
import express from 'express';
import { uploadProductImage } from '../middlewares/upload';

const router = express.Router();

router.post('/upload', uploadProductImage.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'ไม่พบไฟล์ที่อัปโหลด' });

    const url = `/products/${req.file.filename}`;
    res.json({ url });
});

export default router;
