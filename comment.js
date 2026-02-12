require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// ================= MySQL 连接池 =================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10
})

// ================= 初始化数据表 =================
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            likes INT DEFAULT 0,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
    console.log('MySQL connected & table ready')
}

// ================= 时间格式化 =================
function formatTime(date) {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
}

// ================= 获取分页评论 =================
app.get('/comments', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const pageSize = parseInt(req.query.pageSize) || 3
        const offset = (page - 1) * pageSize

        const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM comments')
        const total = totalRows[0].total

        const [rows] = await pool.query(
            'SELECT * FROM comments ORDER BY create_time DESC LIMIT ? OFFSET ?',
            [pageSize, offset]
        )

        const data = rows.map(item => ({
            ...item,
            timeText: formatTime(item.create_time)
        }))

        res.json({
            total,
            page,
            pageSize,
            data
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: '服务器错误' })
    }
})

// ================= 新增评论 =================
app.post('/comments', async (req, res) => {
    try {
        const { name, content } = req.body

        if (!name || !content) {
            return res.status(400).json({ message: '参数不完整' })
        }

        await pool.query(
            'INSERT INTO comments (name, content) VALUES (?, ?)',
            [name, content]
        )

        res.json({ message: 'success' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: '服务器错误' })
    }
})

// ================= 点赞 =================
app.post('/comments/:id/like', async (req, res) => {
    try {
        const id = parseInt(req.params.id)

        await pool.query(
            'UPDATE comments SET likes = likes + 1 WHERE id = ?',
            [id]
        )

        const [rows] = await pool.query(
            'SELECT likes FROM comments WHERE id = ?',
            [id]
        )

        if (!rows.length) {
            return res.status(404).json({ message: 'not found' })
        }

        res.json({ likes: rows[0].likes })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: '服务器错误' })
    }
})

// ================= 启动服务器 =================
app.listen(PORT, async () => {
    await initDB()
    console.log(`Server running at http://localhost:${PORT}`)
})
