'use strict'
const http = require('http')
const fs = require('fs')
const jade = require('jade')
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/reversi'