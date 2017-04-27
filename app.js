// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');
var Swagger = require('swagger-client');
var Promise = require('bluebird');
var url = require('url');
var fs = require('fs');
var util = require('util');
var remotepng = require('./remotepng');
var redis = require('redis');
var client = redis.createClient(6379, 'tradingbot.redis.cache.windows.net', { no_ready_check: true });
client.auth('pm/THZHkMq0u1SfLfuVDNBhDT/v/J5Flu0EpsrLXos4=', function (err) {
    if (err) throw err;
});

client.on("error", function (err) {
    console.log("Error " + err);
});

client.on('connect', function () {
    console.log('Connected to Redis');
});

// Swagger client for Bot Connector API
var connectorApiClient = new Swagger(
    {
        url: 'https://raw.githubusercontent.com/Microsoft/BotBuilder/master/CSharp/Library/Microsoft.Bot.Connector.Shared/Swagger/ConnectorAPI.json',
        usePromise: true
    });

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Functions
//=========================================================

function redisGetSymbol(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var url = 'http://info512.taifex.com.tw/Future/chart.aspx?type=1&size=630400&contract=' + reply.toString() + '&CommodityName=%E8%87%BA%E6%8C%87%E9%81%B8';
        sendInternetUrl(session, url, 'image/gif', '期貨交易資訊');
    });
}

function redisGetSymbol1(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var yyyymm = new Date().getFullYear() + reply.toString().substring(2, 4);;
        remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm, 'options.png').then(function () {
            sendInline(session, './images/options.png', 'image/png', '選擇權報價');
        });
    });
}

function redisGetOptions(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var suggest = reply.toString();
        var result = suggest.split(";");
        if (result[0] === '0') {
            session.endDialog('目前暫無選擇權投資建議！');
        } else {
            remotepng.shotpng1('http://tradingbot.azurewebsites.net/options' + result[0] + '.html', 'options_suggest.png').then(function () {
                sendInline(session, './images/options_suggest.png', 'image/png', '選擇權投資建議');
            });
        }
    });
}

function redisGetSymbol1W(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var yyyymm = reply.toString()
        remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm, 'optionsw.png').then(function () {
            sendInline(session, './images/optionsw.png', 'image/png', '選擇權報價');
        });
    });
}

function redisGetReal(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.send(reply.toString());
    });
}

function redisGetOI(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.endDialog(reply.toString());
    });
}

function redisGetREAL(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.endDialog(reply.toString());
    });
}

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));
//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', '再見囉～歡迎來信指教 tradingbot.tw@gmail.com 期待再次使用！', { matches: [/^goodbye/i, /\u96e2\u958b/, /\u518D\u898B/] });
bot.beginDialogAction('help', '/help', { matches: [/^help/i, /\u5e6b\u5fd9/, /\u6c42\u52a9/, /\u5e6b\u52a9/] });

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session) {
        // Send a greeting and show help.
        var card = new builder.HeroCard(session)
            .title("TradingBot")
            .text("訣竅提醒-有快速選項在右下角。")
            .images([
                builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25264522/249d9720-269a-11e7-9308-8274c496a072.png")
            ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.send("您好～我是TradingBot，除了提供台灣期貨即時動態、每日未平倉資訊，還結合TradingBot自動交易系統的即時交易，並可提供選擇權投資建議，請參考以下選單：");
        session.beginDialog('/help');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Always say goodbye
        session.send("再見囉～歡迎來信指教 tradingbot.tw@gmail.com 期待再次使用！");
    }
]);

bot.dialog('/menu', [
    function (session) {
        //carousel 國際新聞 receipt 訂閱服務 alert 到價提示
        builder.Prompts.choice(session, "請選擇下列功能：", "交易現況|選擇權策略|金融新聞|商品資訊|未平倉量|到價警示|訂閱服務|托播廣告|離開");
    },
    function (session, results) {
        if (results.response && results.response.entity != '離開') {
            // Launch demo dialog
            if (results.response.entity === '交易現況') {
                session.beginDialog('/real');
            } else if (results.response.entity === '選擇權策略') {
                session.beginDialog('/options');
            } else if (results.response.entity === '金融新聞') {
                session.beginDialog('/news');
            } else if (results.response.entity === '商品資訊') {
                session.beginDialog('/info');
            } else if (results.response.entity === '未平倉量') {
                session.beginDialog('/oi');
            } else if (results.response.entity === '到價警示') {
                session.beginDialog('/alert');
            } else if (results.response.entity === '訂閱服務') {
                session.beginDialog('/subscribe');
            } else if (results.response.entity === '托播廣告') {
                session.beginDialog('/ad');
            } else {
                session.beginDialog('/news');
            }
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]).reloadAction('reloadMenu', null, { matches: [/^menu|show menu/i, /\u9078\u55AE/] });

bot.dialog('/help', [
    function (session) {
        session.endDialog("下面指令隨時都可輸入：\n\n* menu - 跳出後回到選單。\n* goodbye - 離開這次交談。\n* help - 顯示求助說明。");
    }
]);

bot.dialog('/prompts', [
    function (session) {
        session.send("Our Bot Builder SDK has a rich set of built-in prompts that simplify asking the user a series of questions. This demo will walk you through using each prompt. Just follow the prompts and you can quit at any time by saying 'cancel'.");
        builder.Prompts.text(session, "Prompts.text()\n\nEnter some text and I'll say it back.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        builder.Prompts.number(session, "Prompts.number()\n\nNow enter a number.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        session.send("Bot Builder includes a rich choice() prompt that lets you offer a user a list choices to pick from. On Facebook these choices by default surface using Quick Replies if there are 10 or less choices. If there are more than 10 choices a numbered list will be used but you can specify the exact type of list to show using the ListStyle property.");
        builder.Prompts.choice(session, "Prompts.choice()\n\nChoose a list style (the default is auto.)", "auto|inline|list|button|none");
    },
    function (session, results) {
        var style = builder.ListStyle[results.response.entity];
        builder.Prompts.choice(session, "Prompts.choice()\n\nNow pick an option.", "option A|option B|option C", { listStyle: style });
    },
    function (session, results) {
        session.send("You chose '%s'", results.response.entity);
        builder.Prompts.confirm(session, "Prompts.confirm()\n\nSimple yes/no questions are possible. Answer yes or no now.");
    },
    function (session, results) {
        session.send("You chose '%s'", results.response ? 'yes' : 'no');
        builder.Prompts.time(session, "Prompts.time()\n\nThe framework can recognize a range of times expressed as natural language. Enter a time like 'Monday at 7am' and I'll show you the JSON we return.");
    },
    function (session, results) {
        session.send("Recognized Entity: %s", JSON.stringify(results.response));
        builder.Prompts.attachment(session, "Prompts.attachment()\n\nYour bot can wait on the user to upload an image or video. Send me an image and I'll send it back to you.");
    },
    function (session, results) {
        var msg = new builder.Message(session)
            .ntext("I got %d attachment.", "I got %d attachments.", results.response.length);
        results.response.forEach(function (attachment) {
            msg.addAttachment(attachment);
        });
        session.endDialog(msg);
    }
]);

bot.dialog('/real', [
    function (session) {
        session.send("今日程式交易自動交易紀錄如下：");
        redisGetREAL("REAL", session)
    }
]);

bot.dialog('/oi', [
    function (session) {
        session.send("今日未平倉資訊如下：");
        redisGetOI("OI", session)
    }
]);

bot.dialog('/alert', [
    function (session) {
        session.send("透過交談方式選擇金融商品，再設定警示條件，如漲跌幅、價格、交易量，符合即可自動通知。");
        session.endDialog("即將推出，敬請期待......");
    }
]);

bot.dialog('/ad', [
    function (session) {
        session.send("歡迎金融業者托播相關商品廣告，並歡迎異業合作，篩選後提供符合粉絲團朋友之相關商品，創造雙贏機會。");
        session.endDialog("即將推出，敬請期待......");
    }
]);

bot.dialog('/cards', [
    function (session) {
        session.send("You can use either a Hero or a Thumbnail card to send the user visually rich information. On Facebook both will be rendered using the same Generic Template...");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Hero Card")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
            ]);
        session.send(msg);

        msg = new builder.Message(session)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Thumbnail Card")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Pike_Place_Market"))
            ]);
        session.endDialog(msg);
    }
]);

bot.dialog('/options', [
    function (session) {
        session.send("依據期貨波動和演算法分析，選擇權投資建議如下：");
        redisGetOptions('OPTIONS', session)
        /*var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ]),
                new builder.HeroCard(session)
                    .title("Pikes Place Market")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
            ]);
        session.endDialog(msg);*/
    }
]);

bot.dialog('/news', [
    function (session) {
        session.send("您可以選擇喜歡的財經新聞，並按下「讚+1」按鈕，以便篩選更優質的新聞，謝謝！");

        // Ask the user to select an item from a carousel.
        var msg = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title("msn 財經")
                    .subtitle("台股站回季線 投信：個股差異將拉大")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25314190/b2f2538e-2871-11e7-83eb-eb41c0db28cd.jpg")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25314157/1fed14f2-2871-11e7-8099-86bc94c582f5.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://www.msn.com/zh-tw/money/topstories/%E5%8F%B0%E8%82%A1%E7%AB%99%E5%9B%9E%E5%AD%A3%E7%B7%9A-%E6%8A%95%E4%BF%A1%E5%80%8B%E8%82%A1%E5%B7%AE%E7%95%B0%E5%B0%87%E6%8B%89%E5%A4%A7/ar-BBAakiQ", "MSN財經"),
                        builder.CardAction.imBack(session, "select:msn", "讚+1")
                    ]),
                new builder.HeroCard(session)
                    .title("鉅亨網")
                    .subtitle("台股重返季線 有望現轉折 惟仍須慎防7大變數")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25314208/2fef7ad8-2872-11e7-96c8-99453d336cdf.jpg")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25314207/2ba72f66-2872-11e7-84ef-0683d8dbf306.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "http://news.cnyes.com/news/id/3788485t", "鉅亨網"),
                        builder.CardAction.imBack(session, "select:cnyes", "讚+1")
                    ]),
                new builder.HeroCard(session)
                    .title("Yahoo!奇摩新聞")
                    .subtitle("《台北股市》當沖降稅28日上路，台股添活水")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25314342/ad9d1b14-2874-11e7-973c-b1f000599f19.png")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25314340/acc8cb48-2874-11e7-90cd-b947739ee75f.png"))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://tw.stock.yahoo.com/news_content/url/d/a/20170423/%E5%8F%B0%E5%8C%97%E8%82%A1%E5%B8%82-%E7%95%B6%E6%B2%96%E9%99%8D%E7%A8%8528%E6%97%A5%E4%B8%8A%E8%B7%AF-%E5%8F%B0%E8%82%A1%E6%B7%BB%E6%B4%BB%E6%B0%B4-055921465.html", "Yahoo!奇摩新聞"),
                        builder.CardAction.imBack(session, "select:yahoo", "讚+1")
                    ])
            ]);
        builder.Prompts.choice(session, msg, "select:msn|select:cnyes|select:yahoo");
    },
    function (session, results) {
        var action, item;
        var kvPair = results.response.entity.split(':');
        switch (kvPair[0]) {
            case 'select':
                action = '很讚！';
                break;
        }
        switch (kvPair[1]) {
            case 'msn':
                item = "台股站回季線 投信：個股差異將拉大";
                break;
            case 'cnyes':
                item = "台股重返季線 有望現轉折 惟仍須慎防7大變數";
                break;
            case 'yahoo':
                item = "《台北股市》當沖降稅28日上路，台股添活水";
                break;
        }
        session.endDialog('您認為 "%s" %s', item, action);
    }
]);

bot.dialog('/subscribe', [
    function (session) {
        session.send("您可以付費取得TradingBot自動交易系統的即時推播資訊，可供參考並審視您期貨投資的進出點，TradingBot交易紀錄僅供參考，並不承擔您交易上的損失，相關問題請見免責聲明。");
        var msg = new builder.Message(session)
            .attachments([
                new builder.ReceiptCard(session)
                    .title("投資推播訂閱服務")
                    .items([
                        builder.ReceiptItem.create(session, "$94.05", "訂閱服務費").image(builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25315599/367e0460-288a-11e7-9fb4-ef0380bd8a88.jpg")),
                    ])
                    .facts([
                        builder.Fact.create(session, "1234567890", "訂單編號"),
                        builder.Fact.create(session, "VISA 1234 4567 7890", "付費方式")
                    ])
                    .tax("NT$4.95")
                    .total("NT$99")
            ]);
        //session.send(msg);

        /*session.send("Or using facebooks native attachment schema...");
        msg = new builder.Message(session)
            .sourceEvent({
                facebook: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "receipt",
                            recipient_name: "Stephane Crozatier",
                            order_number: "12345678902",
                            currency: "USD",
                            payment_method: "Visa 2345",
                            order_url: "http://petersapparel.parseapp.com/order?order_id=123456",
                            timestamp: "1428444852",
                            elements: [
                                {
                                    title: "Classic White T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 2,
                                    price: 50,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/whiteshirt.png"
                                },
                                {
                                    title: "Classic Gray T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 1,
                                    price: 25,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/grayshirt.png"
                                }
                            ],
                            address: {
                                street_1: "1 Hacker Way",
                                street_2: "",
                                city: "Menlo Park",
                                postal_code: "94025",
                                state: "CA",
                                country: "US"
                            },
                            summary: {
                                subtotal: 75.00,
                                shipping_cost: 4.95,
                                total_tax: 6.19,
                                total_cost: 56.14
                            },
                            adjustments: [
                                { name: "New Customer Discount", amount: 20 },
                                { name: "$10 Off Coupon", amount: 10 }
                            ]
                        }
                    }
                }
            });*/
        session.endDialog(msg);
    }
]);

bot.dialog('/actions', [
    function (session) {
        session.send("Bots can register global actions, like the 'help' & 'goodbye' actions, that can respond to user input at any time. You can even bind actions to buttons on a card.");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .buttons([
                        builder.CardAction.dialogAction(session, "weather", "Seattle, WA", "Current Weather")
                    ])
            ]);
        session.send(msg);

        session.endDialog("The 'Current Weather' button on the card above can be pressed at any time regardless of where the user is in the conversation with the bot. The bot can even show the weather after the conversation has ended.");
    }
]);

// Create a dialog and bind it to a global action
bot.dialog('/weather', [
    function (session, args) {
        session.endDialog("The weather in %s is 71 degrees and raining.", args.data);
    }
]);
bot.beginDialogAction('weather', '/weather');   // <-- no 'matches' option means this can only be triggered by a button.

bot.dialog('/info', [
    function (session) {
        builder.Prompts.choice(session, '請問想查看哪種商品資訊？', SelOpts, {
            maxRetries: 3
        });
    },
    function (session, results) {
        var option = results.response ? results.response.entity : Futures;
        switch (option) {
            case Futures:
                return redisGetSymbol('SYMBOL', session);
            //var url = 'http://info512.taifex.com.tw/Future/chart.aspx?type=1&size=630400&contract=' + redisGet("SYMBOL") + '&CommodityName=%E8%87%BA%E6%8C%87%E9%81%B8';
            //return sendInternetUrl(session, url, 'image/gif', '期貨交易資訊');
            case Options:
                return redisGetSymbol1('SYMBOL', session);
            //return uploadFileAndSend(session, './images/big-image.png', 'image/png', 'BotFramework.png');
            case Woptions:
                return redisGetSymbol1W('SYMBOLW', session);
            /*remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm , 'options.png' ).then(function () {
                    sendInline(session, './images/options.png', 'image/png', '選擇權報價');
            });*/
        }
    }]);

var Futures = '期貨走勢';
var Woptions = '周選擇權價格表';
var Options = '選擇權價格表';
var SelOpts = [Futures, Options, Woptions];

// Sends attachment inline in base64
function sendInline(session, filePath, contentType, attachmentFileName) {
    fs.readFile(filePath, function (err, data) {
        if (err) {
            return session.send('Oops. Error reading file.');
        }

        var base64 = Buffer.from(data).toString('base64');

        var msg = new builder.Message(session)
            .addAttachment({
                contentUrl: util.format('data:%s;base64,%s', contentType, base64),
                contentType: contentType,
                name: attachmentFileName
            });

        //session.send(msg);
        session.endDialog(msg);
    });
}

// Uploads a file using the Connector API and sends attachment
function uploadFileAndSend(session, filePath, contentType, attachmentFileName) {

    // read file content and upload
    fs.readFile(filePath, function (err, data) {
        if (err) {
            return session.send('Oops. Error reading file.');
        }

        // Upload file data using helper function
        uploadAttachment(
            data,
            contentType,
            attachmentFileName,
            connector,
            connectorApiClient,
            session.message.address.serviceUrl,
            session.message.address.conversation.id)
            .then(function (attachmentUrl) {
                // Send Message with Attachment obj using returned Url
                var msg = new builder.Message(session)
                    .addAttachment({
                        contentUrl: attachmentUrl,
                        contentType: contentType,
                        name: attachmentFileName
                    });

                session.send(msg);
            })
            .catch(function (err) {
                console.log('Error uploading file', err);
                session.send('Oops. Error uploading file. ' + err.message);
            });
    });
}

// Sends attachment using an Internet url
function sendInternetUrl(session, url, contentType, attachmentFileName) {
    var msg = new builder.Message(session)
        .addAttachment({
            contentUrl: url,
            contentType: contentType,
            name: attachmentFileName
        });

    session.endDialog(msg);
}

// Uploads file to Connector API and returns Attachment URLs
function uploadAttachment(fileData, contentType, fileName, connector, connectorApiClient, baseServiceUrl, conversationId) {

    var base64 = Buffer.from(fileData).toString('base64');

    // Inject the connector's JWT token into to the Swagger client
    function addTokenToClient(connector, clientPromise) {
        // ask the connector for the token. If it expired, a new token will be requested to the API
        var obtainToken = Promise.promisify(connector.addAccessToken.bind(connector));
        var options = {};
        return Promise.all([clientPromise, obtainToken(options)]).then(function (values) {
            var client = values[0];
            var hasToken = !!options.headers.Authorization;
            if (hasToken) {
                var authHeader = options.headers.Authorization;
                client.clientAuthorizations.add('AuthorizationBearer', new Swagger.ApiKeyAuthorization('Authorization', authHeader, 'header'));
            }

            return client;
        });
    }

    // 1. inject the JWT from the connector to the client on every call
    return addTokenToClient(connector, connectorApiClient).then(function (client) {
        // 2. override API client host and schema (https://api.botframework.com) with channel's serviceHost (e.g.: https://slack.botframework.com or http://localhost:NNNN)
        var serviceUrl = url.parse(baseServiceUrl);
        var serviceScheme = serviceUrl.protocol.split(':')[0];
        client.setSchemes([serviceScheme]);
        client.setHost(serviceUrl.host);

        // 3. POST /v3/conversations/{conversationId}/attachments
        var uploadParameters = {
            conversationId: conversationId,
            attachmentUpload: {
                type: contentType,
                name: fileName,
                originalBase64: base64
            }
        };

        return client.Conversations.Conversations_UploadAttachment(uploadParameters)
            .then(function (res) {
                var attachmentId = res.obj.id;
                var attachmentUrl = serviceUrl;

                attachmentUrl.pathname = util.format('/v3/attachments/%s/views/%s', attachmentId, 'original');
                return attachmentUrl.format();
            });
    });
}
