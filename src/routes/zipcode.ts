import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

interface AddressEntry {
    name_th: string;
    amphure: {
        name_th: string;
        province: {
            name_th: string;
        };
    };
    zip_code: string;
}


const rawData = fs.readFileSync(
    path.join(__dirname, '../data/api_revert_tambon_with_amphure_province.json'),
    'utf-8'
);
const addressData: AddressEntry[] = JSON.parse(rawData);

router.get('/:zip', (req, res, next) => {
    try {
        //console.log('📦 ตัวอย่างข้อมูล:', addressData.slice(0, 3));
        const zip = req.params.zip;
        //console.log('🔍 ค้นหา ZIP:', zip);

        const matches = addressData.filter(
            (item) => String(item.zip_code) === zip

        );
        //console.log('🧾 จำนวนที่พบ:', matches.length);

        if (matches.length === 0) {
            console.warn('❌ ไม่พบรหัสไปรษณีย์:', zip);
            return res.status(404).json({ message: 'ไม่พบรหัสไปรษณีย์นี้' });
        }

        // เอาข้อมูลรายการแรกพอ

        return res.status(200).json({
            subdistrict: matches[0].name_th,
            district: matches[0].amphure.name_th,
            province: matches[0].amphure.province.name_th,
        });
    } catch (err) {
        console.error('💥 ERROR ที่ /zipcode/:zip', err);
        next(err);
    }
});

export default router;
