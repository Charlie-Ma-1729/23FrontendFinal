const express = require('express');
const ejs = require('ejs');
const path = require('path');
const bodyparser = require('body-parser');
const jwt = require('jsonwebtoken');
const cookieparser = require('cookie-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const multer = require("multer");
const fs = require('fs');
const { config } = require('process');
const app = express();
dotenv.config();
const request = require('request');
const cheerio = require('cheerio');
const xpath = require('xpath');
const dom = require('@xmldom/xmldom').DOMParser;

const { dirname } = require('path');
const { FILE } = require('dns');
const { containeranalysis_v1alpha1 } = require('googleapis');

const mongoDB = process.env.DB;



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({ extended: false }))
app.use(cookieparser());
let vjson = {};

app.use('/assets', express.static('assets'))
app.use('/node_modules', express.static('node_modules'))
app.use('/images', express.static('images'))


mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("DB connect!")
    })
    .catch((err) => {
        console.log(err)
    })

const Schema = mongoose.Schema;
const BookSchema = new Schema(
    {
        bookname: {
            type: String
        },
        author: {
            type: String
        },
        randomid: {
            type: Number
        },
        isbn: {
            type: Number
        },
        pic: {
            type: String
        },
        link: {
            type: String
        }
    }
)
const BookData = mongoose.model('books', BookSchema)

const getBookData = (isbn) => {
    let dataArray = [];
    return new Promise((resolve, reject) => {
        request.post({
            url: "https://search.books.com.tw/search/query/key/" + isbn + "/cat/BKA",
        }, function (err, res, body) {
            let $ = cheerio.load(body);
            dataArray.push($('#search_block_1 > div > div > div > div.table-searchbox.clearfix > div > div > div:nth-child(1) > h4 > a').text())

            dataArray.push($('#search_block_1 > div > div > div > div.table-searchbox.clearfix > div > div > div:nth-child(1) > div.type.clearfix > p.author > a:nth-child(1)').text())
            dataArray.push($('#search_block_1 > div > div > div > div.table-searchbox.clearfix > div > div > div:nth-child(1) > div.box > a > img').attr('data-src').replace('w=187&h=187', 'w=300&h=300'))
            dataArray.push('https:' + $('#search_block_1 > div > div > div > div.table-searchbox.clearfix > div > div > div:nth-child(1) > div.box > a').attr('href'))
            resolve(dataArray);
        })
    })
}


const BookStorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./announcements"); //important this is a direct path fron our current file to storage location
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});



const announce = multer({ storage: BookStorageEngine });



app.get('/login', (req, res) => {
    res.render('login');
})

app.post('/login', (req, res) => {
    if (req.body.username == process.env.ADMIN && req.body.password == process.env.PASSWORD) {
        var token = jwt.sign({ username: req.body.username }, process.env.SECRET, { expiresIn: '1h' });
        res.cookie("token", token);
        res.redirect('books');
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

    app.get('/nolink', (req, res) => {
        res.send('<h1>連結不可用</h1>');
    })

app.get('/books', function (req, res) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                let bdatas = await BookData.find();
                let bdataLength = bdatas.length;
                res.render('books', {
                    bdlength: bdataLength,
                    bdata: bdatas
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/postpage', function (req, res) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                res.render('postpage');
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/newBook', function (req, res) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                res.render('newBook', {
                    title: '',
                    author: '',
                    pic: '',
                    isbn: '',
                    link: ''
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.post('/searchISBN', async function (req, res) {
    let isbn = req.body.isbn;
    let dataArray = [];
    await getBookData(isbn).then((result) => {
        dataArray = result;
    });
    console.log(dataArray[3]);
    res.render('newBook', {
        title: dataArray[0],
        author: dataArray[1],
        pic: dataArray[2],
        link: dataArray[3],
        isbn: isbn
    });
});

app.post('/addNew', async function (req, res) {
    let randomid = Date.now();
    let dataArray = [];
    let isbn = req.body.isbn;
    let link = req.body.link;
    if (isbn) {
        await getBookData(isbn).then((result) => {
            dataArray = result;
        });
    } else {
        dataArray[2] = '/images/No Image.png';
    }
    if (!link) {
        link = '/nolink';
    }
    const newBook = new BookData({
        bookname: req.body.title,
        author: req.body.author,
        randomid: randomid,
        isbn: req.body.isbn,
        pic: dataArray[2],
        link: link
    })
    await newBook.save();
    res.redirect('books');
});

app.get('/bdata/:id', (req, res) => {
    let rid = req.params.id;
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                let rdata = await BookData.findOne({ randomid: rid });
                res.render('bdata', {
                    data: rdata
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/announcement/:id', async (req, res) => {
    let rid = req.params.id;
    let rdata = await BookData.findOne({ randomid: rid });
    res.render('announcement', {
        data: rdata
    });
});

app.post('/bedit/:randomid', async function (req, res) {

    let randomid = req.params.randomid;
    let filter = { randomid: randomid };
    let update = {
        bookname: req.body.bookname,
        author: req.body.author,
        isbn: req.body.isbn,
        link: req.body.link
    };
    await BookData.findOneAndUpdate(filter, update);
    res.redirect('/books');
});

app.get('/bedit/:id', async (req, res) => {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                let rid = req.params.id;
                let rdata = await BookData.findOne({ randomid: rid });
                res.render('bedit', {
                    data: rdata
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/bdelete/:id', async (req, res) => {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                let rid = req.params.id;
                BookData.findOneAndDelete({ randomid: rid }, function (err, docs) {
                    if (err) {
                        res.send(err)
                    }
                    else {
                        res.redirect('/books');
                    }
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});


app.get('/', async (req, res) => {
    let bdatas = await BookData.find();
    let bdataLength = bdatas.length;
    res.render('index', {
        bdata: bdatas,
        dlength: bdataLength
    });
})

app.listen(1600, () => {
    console.log("server started on 1600")
})


