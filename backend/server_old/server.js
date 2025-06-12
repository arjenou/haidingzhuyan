const express = require('express');
const multer = require('multer');
const cors = require('cors');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// 初始化 Express 应用
const app = express();
app.use(cors());
app.use(express.json());

// 配置 multer 进行文件上传处理
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制文件大小为 5MB
  }
});

// 创建 R2 客户端
const s3 = new AWS.S3({
  endpoint: config.r2.endpoint,
  accessKeyId: config.r2.accessKeyId,
  secretAccessKey: config.r2.secretAccessKey,
  region: config.r2.region,
  signatureVersion: 'v4',
});

// 上传海报到 R2
app.post('/api/upload-poster', upload.single('poster'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const fileContent = fs.readFileSync(req.file.path);
    const fileName = `posters/${Date.now()}-${path.basename(req.file.originalname)}`;

    await s3.putObject({
      Bucket: config.r2.bucket,
      Key: fileName,
      Body: fileContent,
      ContentType: req.file.mimetype,
    }).promise();

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    // 生成预签名URL而不是直接的URL
    const url = s3.getSignedUrl('getObject', {
      Bucket: config.r2.bucket,
      Key: fileName,
      Expires: 60 * 60 * 24 * 7, // URL有效期7天
    });

    res.json({ 
      success: true, 
      url: url,
      key: fileName
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '文件上传失败', details: error.message });
  }
});

// 获取海报的预签名URL (用于下载)
app.get('/api/get-poster-url/:key', async (req, res) => {
  try {
    const key = req.params.key;
    
    const url = s3.getSignedUrl('getObject', {
      Bucket: config.r2.bucket,
      Key: key,
      Expires: 60 * 60, // URL有效期1小时
    });
    
    res.json({ url });
  } catch (error) {
    console.error('获取URL错误:', error);
    res.status(500).json({ error: '获取下载URL失败', details: error.message });
  }
});

// 获取所有海报
app.get('/api/list-posters', async (req, res) => {
  try {
    const data = await s3.listObjects({
      Bucket: config.r2.bucket,
      Prefix: 'posters/'
    }).promise();
    
    const posters = data.Contents.map(item => ({
      key: item.Key,
      lastModified: item.LastModified,
      size: item.Size,
      url: `${config.r2.endpoint}/${config.r2.bucket}/${item.Key}`
    }));
    
    res.json({ posters });
  } catch (error) {
    console.error('列表错误:', error);
    res.status(500).json({ error: '获取海报列表失败', details: error.message });
  }
});

// 删除海报
app.delete('/api/delete-poster/:key', async (req, res) => {
  try {
    const key = req.params.key;
    
    await s3.deleteObject({
      Bucket: config.r2.bucket,
      Key: key
    }).promise();
    
    res.json({ success: true, message: '海报已删除' });
  } catch (error) {
    console.error('删除错误:', error);
    res.status(500).json({ error: '删除海报失败', details: error.message });
  }
});

// 确保上传目录存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 启动服务器
const PORT = config.port || 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 