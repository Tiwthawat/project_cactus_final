// middlewares/upload.ts
import fs from 'fs';
import multer from 'multer';
import path from 'path';

// 👉 สำหรับอัปโหลดสลิป
const slipDir = path.join(__dirname, '..', 'public', 'slips');
if (!fs.existsSync(slipDir)) fs.mkdirSync(slipDir, { recursive: true });

const slipStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, slipDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
export const uploadSlip = multer({ storage: slipStorage });

// 👉 สำหรับอัปโหลด QR
const qrDir = path.join(__dirname, '..', 'public', 'qrs');
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

const qrStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, qrDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
export const uploadQr = multer({ storage: qrStorage });


// 👉 สำหรับอัปโหลดรูปสินค้า
// middlewares/upload.ts
const productDir = path.join(__dirname, '..', 'public', 'products');
if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });

const productStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, productDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

// 👉 สำหรับอัปโหลดรูปโปรไฟล์ผู้ใช้
const profileDir = path.join(__dirname, '..', 'public', 'profiles');
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});



export const uploadProfilePicture = multer({ storage: profileStorage });


export const uploadProductImage = multer({ storage: productStorage });

