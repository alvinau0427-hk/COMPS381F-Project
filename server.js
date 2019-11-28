const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = "mongodb+srv://kaze:2RmgE3TmtS8qUUGY@cluster0-rhlsu.azure.mongodb.net/test?retryWrites=true&w=majority";
const dbName = "test";
const fs = require('fs');
const formidable = require('formidable');
const app = express();

app.set('view engine','ejs');

app.use(session({
    name: 'session',
    keys: ['secret']
}));

const users = new Array(
	{name: 'demo01', password: ''},
	{name: 'demo02', password: ''}
);

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({extended:true}));

app.get('/',(req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.redirect('/restaurants');
    }
});

app.get('/login', (req,res) => {
    res.status(200).render('login.ejs');
});

app.post('/login', (req,res) => {
    users.forEach((user) => {
        if (user.name == req.body.name && user.password == req.body.password) {
            req.session.authenticated = true;
            req.session.username = user.name;
        }
    });
    res.redirect('/restaurants');
});

app.get('/restaurants', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        let client = new MongoClient(mongourl);
        client.connect((err) => {
            try {
                assert.equal(err,null);
            } catch (err) {
                res.status(500).end("MongoClient connect() failed!");
            }
            console.log('Connected to MongoDB');
            const db = client.db(dbName);
            findRestaurants(db,{},(restaurants) => {
                client.close();
                console.log('Disconnected MongoDB');
                res.render('list.ejs',{username:req.session.username,restaurants:restaurants});
            });
        });
    }
});

app.get('/create', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.render('create.ejs');
    }
});

app.post('/create', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        const form = new formidable.IncomingForm();
        form.parse(req, (err,fields,files) => {
            let new_r = {};
            new_r['name'] = fields.name;
            new_r['borough'] = fields.borough || '';
            new_r['cuisine'] = fields.cuisine || '';
            new_r['address'] = {};
            new_r['address']['street'] = fields.street || '';
            new_r['address']['building'] = fields.building || '';
            new_r['address']['zipcode'] = fields.zipcode || '';
            new_r['address']['coord'] = [fields.lat || '',fields.long || ''];
            new_r['grades'] = [];
            new_r['owner'] = req.session.username;
            if (files.photo.size == 0) {
                let client = new MongoClient(mongourl);
                client.connect((err) => {
                    try {
                        assert.equal(err,null)
                    } catch (err) {
                        res.status(500).end("MongoClient connect() failed!");
                    }
                    const db = client.db(dbName);
                    new_r['photo'] = '';
                    new_r['photo_mimetype'] = '';
                    insertRestaurants(db,new_r,(result) => {
                        client.close();
                        res.redirect('/restaurants');
                    });
                });
            } else {
                fs.readFile(files.photo.path, (err,data) => {
                    let client = new MongoClient(mongourl);
                    client.connect((err) => {
                        try {
                            assert.equal(err,null);
                        } catch (err) {
                            res.status(500).end("MongoClient connect() failed!");
                        }
                        const db = client.db(dbName);
                        new_r['photo'] = new Buffer.from(data).toString('base64');
                        new_r['photo_mimetype'] = files.photo.type;
                        insertRestaurants(db,new_r,(result) => {
                            client.close();
                            res.redirect('/restaurants');
                        });
                    });
                });
            }
        });
    }
});

app.get('/detail', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        let client = new MongoClient(mongourl);
        client.connect((err) => {
            try {
                assert.equal(err,null);
            } catch (err) {
                res.status(500).end("MongoClient connect() failed!");
            }
            console.log('Connected to MongoDB');
            const db = client.db(dbName);
            let criteria = {};
            criteria['_id'] = ObjectID(req.query._id);
            findRestaurants(db,criteria,(restaurant) => {
                client.close();
                console.log('Disconnected MongoDB');
                console.log('Restaurant returned = ' + restaurant.length);
                res.render('restaurant.ejs',{restaurant:restaurant});
            });
        });
    }
});

app.get('/logout', (req,res) => {
    req.session = null;
    res.redirect("/login");
});

app.get('/api/restaurant/name/:name', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end('MongoClient connect() failed!');
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['name'] = req.params.name;
        findRestaurants(db,criteria,(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.status(200).type('json').json(restaurants).end();
        });
    });
});

app.get('/api/restaurant/borough/:borough', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end('MongoClient connect() failed!');
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['borough'] = req.params.borough;
        findRestaurants(db,criteria,(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.status(200).type('json').json(restaurants).end();
        });
    });
});

app.get('/api/restaurant/cuisine/:cuisine', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end('MongoClient connect() failed!');
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['cuisine'] = req.params.cuisine;
        findRestaurants(db,criteria,(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.status(200).type('json').json(restaurants).end();
        });
    });
});

app.listen(process.env.PORT || 8099);

const findRestaurants = (db,criteria,callback) => {
    const cursor = db.collection("restaurants").find(criteria).limit(20);
    let restaurants = [];
    cursor.forEach((doc) => {
        restaurants.push(doc);
    }, (err) => {
        assert.equal(err,null);
        callback(restaurants);
    })
};

const insertRestaurants = (db,r,callback) => {
    db.collection('restaurants').insertOne(r,(err,result) => {
        assert.equal(err,null);
        console.log("insert was successful!");
        console.log(JSON.stringify(result));
        callback(result);
    });
};