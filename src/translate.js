const querystring = require("querystring");

const request = require("request");
const token = require("./token");
const cookie = require("./cookie");
const store = require("./store");

const { transapi } = require("./constant");

const translate = {
    v1: opts => {
        return new Promise((resolve, reject) => {
            request(`${transapi.v1}?${querystring.stringify(opts)}`, (err, res, body = "") => {
                if (err) return reject(err);

                let result = JSON.parse(body);

                if (result.error) return reject(result);

                const { from, to, data } = result;
                const { dst, src } = data[0];

                resolve({
                    from,
                    to,
                    trans_result: {
                        dst,
                        src
                    }
                });
            });
        });
    },
    v2: ({ query, from, to }) => {
        return new Promise((resolve, reject) => {
            token.get(query).then(({ sign, token }) => {
                const data = {
                    transtype: "realtime",
                    simple_means_flag: 3,
                    from, to, query, sign, token
                };
                const url = `${transapi.v2}?${querystring.stringify(data)}`;
                const jar = request.jar();
                const cookies = store.getCookies();

                jar.setCookie(cookies.value, url);

                request(url, { jar }, (err, res, body) => {
                    if (err) return reject(err);

                    let result = JSON.parse(body);

                    if (result.error) return reject(result);

                    let { dst, src, from, to } = result.trans_result.data[0];

                    resolve({
                        from,
                        to,
                        trans_result: {
                            dst,
                            src
                        }
                    });
                });
            });
        });
    },
    langdetect: query => {
        return new Promise((resolve, reject) => {
            const url = `${transapi.langdetect}?query=${encodeURIComponent(query)}`;

            request(url, (err, res, body) => {
                if (err) return reject(err);

                let result = JSON.parse(body);

                if (result.error) return reject(result);

                resolve(result.lan);
            });
        });
    }
};

const language = require("./language");
const { Auto, English } = language;

module.exports = (query, opts = {}) => {
    let { from = Auto, to = English, keywords = false } = opts;
    let _translate = () => {
        if (keywords === false) return translate.v1({ query, from, to });

        return cookie.get().then(() => {
            return translate.v2({ query, from, to });
        });
    };

    return new Promise(resolve => {
        if (from !== Auto) {
            return resolve(_translate());
        }

        translate.langdetect(query).then(lan => {
            from = lan;
            resolve(_translate());
        });
    });
};

module.exports.language = language;
