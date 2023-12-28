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
app.use('/announcements', express.static('announcements'))
app.use('/articles', express.static('articles'))


mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("DB connect!")
    })
    .catch((err) => {
        console.log(err)
    })

const Schema = mongoose.Schema;
const AnnounceSchema = new Schema(
    {
        title: {
            type: String
        },
        bookname: {
            type: String
        },
        date: {
            type: String
        },
        randomid: {
            type: Number
        },
        rate: {
            tyoe: String
        },
        comment:{
            type: String
        }
    }
)
const AnnounceData = mongoose.model('announce', AnnounceSchema)

const announcementStorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./announcements"); //important this is a direct path fron our current file to storage location
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});



const announce = multer({ storage: announcementStorageEngine });



app.get('/login', (req, res) => {
    res.render('login');
})

app.post('/login', (req, res) => {
    if (req.body.username == process.env.ADMIN && req.body.password == process.env.PASSWORD) {
        var token = jwt.sign({ username: req.body.username }, process.env.SECRET, { expiresIn: '1h' });
        res.cookie("token", token);
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
    res.redirect('posts');
});

app.get('/posts', function (req, res) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                let adatas = await AnnounceData.find();
                let adataLength = adatas.length;
                res.render('posts', {
                    adlength: adataLength,
                    adata: adatas
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

app.get('/announcepage', function (req, res) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, process.env.SECRET, async function (err) {
            if (err) {
                console.log("token錯誤");
                res.clearCookie('token');
                res.send('<h1>無效的登入</h1>');
                //token過期判斷
            }
            else {
                res.render('announcepage');
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.post('/announce', announce.single("announcement"), async function (req, res) {
    let ofname = req.file.originalname;
    let randomid = Date.now();
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    let yyyy = today.getFullYear();
    let date = yyyy + "/" + mm + "/" + dd;
    fs.rename('./announcements/' + ofname, './announcements/' + randomid + ".md", function (err) {
        if (err) throw err;
        console.log('File Renamed.');
    });

    const newAnnounce = new AnnounceData({
        title: req.body.title,
        category: req.body.category,
        date: date,
        randomid: randomid,
        keywords: req.body.keywords,
        description: req.body.description
    })
    await newAnnounce.save();
    res.redirect('posts');
});

app.get('/adata/:id', (req, res) => {
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
                let rdata = await AnnounceData.findOne({ randomid: rid });
                res.render('adata', {
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
    let rdata = await AnnounceData.findOne({ randomid: rid });
    res.render('announcement', {
        data: rdata
    });
});

app.post('/aedit', announce.single("announcement"), async function (req, res) {

    let ofname = req.file.originalname;
    let randomid = req.body.randomid;
    fs.rename('./announcements/' + ofname, './announcements/' + randomid + ".md", function (err) {
        if (err) throw err;
        console.log('File Renamed.');
    });

    let filter = { randomid: randomid };
    let update = {
        title: req.body.title,
        category: req.body.category,
        keywords: req.body.keywords,
        description: req.body.description
    };
    await AnnounceData.findOneAndUpdate(filter, update);
    res.redirect('posts');
});

app.get('/aedit/:id', async (req, res) => {
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
                console.log(rid);
                let rdata = await AnnounceData.findOne({ randomid: rid });
                res.render('aedit', {
                    data: rdata
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/adelete/:id', async (req, res) => {
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
                fs.unlink('announcements/' + rid + '.md', (err) => {
                    if (err) throw err;
                    console.log('announcements/' + rid + '.md was deleted');
                });
                AnnounceData.findOneAndDelete({ randomid: rid }, function (err, docs) {
                    if (err) {
                        res.send(err)
                    }
                    else {
                        res.redirect('/posts');
                    }
                });
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/adownload/:id', async (req, res) => {
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
                res.download("./announcements/" + rid + ".md");
            }
        })
    }
    else {
        res.send('<h1>無效的登入</h1>');
    }
});

app.get('/announcements', async (req, res) => {
    let adatas = await AnnounceData.find();
    let adataLength = adatas.length;
    res.render('announcements', {
        data: adatas,
        dlength: adataLength
    });
})

app.listen(1600, () => {
    console.log("server started on 1600")
})


