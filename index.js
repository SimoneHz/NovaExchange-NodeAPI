var verbose = false

var util = require('util'),
    _ = require('underscore'),
    request	= require('request'),
    crypto = require('crypto'),
    VError = require('verror'),
    md5 = require('MD5')

var NovaExchange = function NovaExchange(api_key, secret, server, timeout)
{
    this.api_key = api_key;     // API Key
    this.secret = secret;       // API Secret

    this.server = server || 'https://novaexchange.com'
    this.privateApiPath = 'remote/v2/private'
    this.marketsApiPath = 'remote/v2/markets'

    this.timeout = timeout || 20000
}

var headers = {"User-Agent": "nodejs-7.5-api-client"}

/**
 * This method prepare the market API request for the execution
 * @method  {String}  method  The API method
 * @param  {Object}  params  The object containing the request parameters
 */
NovaExchange.prototype.privateRequest = function(method, params, callback)
{
    var functionName = 'NovaExchange.privateRequest()',
        self = this

    var error;
    
    if(!this.api_key || !this.secret)
    {
        error = new VError('%s must provide api_key and secret to make this API request.', functionName)
        return callback(error)
    }

    if(!_.isObject(params))
    {
        error = new VError('%s second parameter %s must be an object. If no params then pass an empty object {}', functionName, params)
        return callback(error)
    }

    if (!callback || typeof(callback) != 'function')
    {
        error = new VError('%s third parameter needs to be a callback function', functionName)
        return callback(error)
    }
    
    var requestURL = this.server + '/' + this.privateApiPath + '/' + method + '/?nonce=' + this.generateNonce();
    
    params.apikey = this.api_key
    params.signature = this.signMessage(requestURL)    
       
    var options = {
        url:    requestURL,
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        form: params
    }

    var requestDesc = util.format('%s request to url %s with method %s and params %s',
        options.method, options.url, method, JSON.stringify(params))

    executeRequest(options, requestDesc, callback)
}

/**
 * This method prepare the market API request for the execution
 * @method  {String}  method  The API method
 * @param  {Object}  params  The object containing the request parameters
 */
NovaExchange.prototype.marketRequest = function(method, params, callback)
{
    var functionName = 'NovaExchange.marketRequest()',
        self = this

    var error;
    
    
    if(!this.api_key || !this.secret)
    {
        error = new VError('%s must provide api_key and secret to make this API request.', functionName)
        return callback(error)
    }

    if(!_.isObject(params))
    {
        error = new VError('%s second parameter %s must be an object. If no params then pass an empty object {}', functionName, params)
        return callback(error)
    }

    if (!callback || typeof(callback) != 'function')
    {
        error = new VError('%s third parameter needs to be a callback function', functionName)
        return callback(error)
    }
    
    if (method == "markets"){
         var requestURL = this.server + '/' + this.marketsApiPath + 's/' + method + '/';
    }else{
         var requestURL = this.server + '/' + this.marketsApiPath + '/' + method + '/?nonce=' + this.generateNonce();
    }
    
    params.apikey = this.api_key
    params.signature = this.signMessage(requestURL)    
       
    var options = {
        url:    requestURL,
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        form: params
    }

    var requestDesc = util.format('%s request to url %s with method %s and params %s',
        options.method, options.url, method, JSON.stringify(params))

    executeRequest(options, requestDesc, callback)
}

/**
 * This method returns a signature for a request as a base64-encoded string
 * @param  {Object}  message  The object to encode
 * @return {String}           The request signature
 */
NovaExchange.prototype.signMessage = function getMessageSignature(message)
{
    return (crypto.createHmac('sha512',this.secret).update(message).digest('base64'))
}

/**
 * This method returns a nonce for NovaExchange's API.
 * @return {String}           The unique request Nonce
 */
NovaExchange.prototype.generateNonce = function getNonce()
{
    var dateSeed = parseInt(Date.now() / 1000)
    return (dateSeed)
}

/* @param  {Object}  params   The parameter object to encode
 * @return {String}           formatted parameters
 */
function formatParameters(params)
{
    var sortedKeys = [],
        formattedParams = ''

    // sort the properties of the parameters
    sortedKeys = _.keys(params).sort()

    // create a string of key value pairs separated by '&' with '=' assignement
    for (i = 0; i < sortedKeys.length; i++)
    {
        if (i !== 0) {
            formattedParams += '&'
        }
        formattedParams += sortedKeys[i] + '=' + params[sortedKeys[i]]
    }

    return formattedParams
}


/* @param   {Object}  options       The parameter object to encode
 * @param   {String}  requestDesc   request description
 */
function executeRequest(options, requestDesc, callback)
{
    var functionName = 'NovaExchange.executeRequest()'

    request(options, function(err, response, data)
    {
        var error = null,   // default to no errors
            returnObject = data

        if(err)
        {
            error = new VError(err, '%s failed %s', functionName, requestDesc)
            error.name = err.code
        }
        else if (response.statusCode < 200 || response.statusCode >= 300)
        {
            error = new VError('%s HTTP status code %s returned from %s', functionName,
                response.statusCode, requestDesc)
            error.name = response.statusCode
        }
        else if (options.form)
        {
            try {
                returnObject = JSON.parse(data)
            }
            catch(e) {
                error = new VError(e, 'Could not parse response from server: ' + data)
            }
        }
        // if json request was not able to parse json response into an object
        else if (options.json && !_.isObject(data) )
        {
            error = new VError('%s could not parse response from %s\nResponse: %s', functionName, requestDesc, data)
        }

        if (_.has(returnObject, 'error_code'))
        {
            var errorMessage = mapErrorMessage(returnObject.error_code)

            error = new VError('%s %s returned error code %s, message: "%s"', functionName,
                requestDesc, returnObject.error_code, errorMessage)

            error.name = returnObject.error_code
        }

        callback(error, returnObject)
    })
}

//
// Public Functions

/////////////////////////
// Market API Requests //
/////////////////////////

// listMarketsSummary       -   List markets summary, including cached tickerdata (Limited to 1 request per minute).
//                          -   basecurrency:     the selected currency, ex. 'BTC'
NovaExchange.prototype.listMarketsSummary = function listMarketsSummary(callback, basecurrency)
{
    this.marketRequest('markets/' + basecurrency, {} , callback)
}

// getMarketSummary         -   get the Market summary for a single market
//                          -   market:     the selected market, ex. 'BTC_XZC'
NovaExchange.prototype.getMarketSummary = function getMarketSummary(callback, market)
{
    this.marketRequest('info/' + market , {} , callback)
}

// getMarketOrderHistory    -   Get the Ticker / Order history for market
//                          -   market:     the selected market, ex. 'BTC_XZC'
NovaExchange.prototype.getMarketOrderHistory = function getMarketOrderHistory(callback, market)
{
    this.marketRequest('orderhistory/' + market , {} , callback)
}

// getMarketOpenOrders      -   Get the currently open orders for market
//                          -   market:     the selected market, ex. 'BTC_XZC'
//                          -   type:       can be 'SELL', 'BUY' or 'BOTH'
NovaExchange.prototype.getMarketOpenOrders = function getMarketOpenOrders(callback, market, type)
{
    this.marketRequest('openorders/' + market + '/' + type , {} , callback)
}



/////////////////////////
// Private API Requests//
/////////////////////////

// getBalances      -   Get the balance info for all the available wallets
NovaExchange.prototype.getBalances = function getBalances(callback)
{    
    this.privateRequest('getbalances', {} , callback)
}

// getBalance      -   Get the balance info for the specified currency
//                 -   currency:     the selected currency, ex. 'BTC'
NovaExchange.prototype.getBalance = function getBalance(callback, currency)
{
    if (currency != ""){
        currency = "/" + currency
    }
    
    this.privateRequest('getbalance' + currency, {} , callback)
}

// getDeposits      -   Get current incoming deposits
NovaExchange.prototype.getDeposits = function getDeposits(callback)
{    
    this.privateRequest('getdeposits', {} , callback)
}

// getWithdrawals       -   Get current outgoing withdrawals
NovaExchange.prototype.getWithdrawals = function getWithdrawals(callback)
{    
    this.privateRequest('getwithdrawals', {} , callback)
}

// getNewDepositAddress      -   Get a new deposit address for a specific currency
//                           -   currency:     the selected currency, ex. 'BTC'
NovaExchange.prototype.getNewDepositAddress = function getNewDepositAddress(callback, currency)
{    
    this.privateRequest('getnewdepositaddress/' + currency, {} , callback)
}

// getDepositAddress        -   Get the deposit address for currency
//                          -   currency:     the selected currency, ex. 'BTC'
NovaExchange.prototype.getDepositAddress = function getDepositAddress(callback, currency)
{    
    this.privateRequest('getdepositaddress/'+ currency, {} , callback)
}

// getOpenOrders        -   Get the account open orders
//                      -   [market]:    specify a single market, ex. 'BTC_XZC' -   [OPTIONAL]
//                      -   [page]:      list a specific order page  -   [OPTIONAL, default = 1]
NovaExchange.prototype.getOpenOrders = function getOpenOrders(callback, page, market)
{
    if (market != ""){
        var request = "myopenorders_market/" + market
        var params = {}
    }else{
        var request = 'myopenorders';
            page = page || '1';
            var params = {
                page: page
            }
    }
    
    this.privateRequestParams(request, params, callback)
}

// cancelOrder      -   Cancel order
//                  -   order_id:   specific order id to cancel
NovaExchange.prototype.cancelOrder = function cancelOrder(callback, order_id)
{
    this.privateRequest('cancelorder/'+ market, {} , callback)
}

// exeWithdraw      -   Execute a withdraw
//                  -   currency:   the selected currency, ex. 'BTC'
//                  -   amount:     the amount to withdrawn
//                  -   address:    address to send the coins
NovaExchange.prototype.exeWithdraw = function exeWithdraw(callback, currency, amount, address)
{
    var params = {
        currency: currency,
        amount: amount,
        address: address
    }
    
    this.privateRequestParams('withdraw/' + currency, params , callback)
}

// exeTrade     -   Execute a trade order
//              -   market:         the selected market, ex. 'BTC_XZC'
//              -   tradetype:      can be 'SELL', 'BUY' or 'BOTH'
//              -   tradeamount:    the amount to trade, ex. 8000.00000000
//              -   tradeprice:     the trade price, ex. 0.00000008
//              -   tradebase:      0 (Set as 0 for market currency or 1 for basecurrency as tradeamount)
NovaExchange.prototype.exeTrade = function exeTrade(callback, market, tradetype, tradeamount, tradeprice, tradebase)
{
    var params = {
        tradetype: tradetype,
        tradeamount: tradeamount,
        tradeprice: tradeprice,
        tradebase: tradebase
    }
    
    this.privateRequestParams('trade/' + market, params , callback)
}

//  getTradeHistory     -   get the Trade history
//                      -   [page]:      list a specific order page  -   [OPTIONAL, default = 1]
NovaExchange.prototype.getTradeHistory = function getTradeHistory(callback, page)
{
    page = page || '1';
    
    var params = {
        page: page
    }
    
    this.privateRequestParams('tradehistory', params , callback)
}

//  getDepositHistory       -   get the Deposit history
//                          -   [page]:      list a specific order page  -   [OPTIONAL, default = 1]
NovaExchange.prototype.getDepositHistory = function getDepositHistory(callback, page)
{
    page = page || '1';
    
    var params = {
        page: page
    }
    
    this.privateRequestParams('getdeposithistory', params , callback)
}

// getWithdrawalHistory     -   get the Withdrawal history
//                          -   [page]:      list a specific order page  -   [OPTIONAL, default = 1]
NovaExchange.prototype.getWithdrawalHistory = function getWithdrawalHistory(callback, page)
{
    page = page || '1';
    
    var params = {
        page: page
    }
    
    this.privateRequestParams('getwithdrawalhistory', params , callback)
}

// getWalletStatus      -   get Coininfo and Wallet status
//                      -   [currency]:     the selected currency, ex. 'BTC'    -   [OPTIONAL, by default WalletInfo for all listed wallets]
//  
//     Wallet status numbers:
//      0 - Wallet OK
//      1 - Wallet in maintenance
//      2 - Wallet not in sync
//      3 - Wallet not available
//      4 - Wallet offline?! Daemon dead?
//      5 - Unknown status...
//      6 - Wallet being delisted, please withdraw your coins.
NovaExchange.prototype.getWalletStatus = function getWalletStatus(callback, currency)
{
    if (currency != ""){
        currency = '/' +currency
    }
    
    this.privateRequest('walletstatus'+ currency, {} , callback)
}

/**
 * Maps the NovaExchange error codes to error message  !!! To be Updated !!!
 * @param  {Integer}  error_code   NovaExchange error code
 * @return {String}                error message
 */
function mapErrorMessage(error_code)
{
    var errorCodes = {
        10000: 'Required parameter can not be null',
        10001: 'Requests are too frequent',
        10002: 'System Error',
        10003: 'Restricted list request, please try again later',
        10004: 'IP restriction',
        10005: 'Key does not exist',
        10006: 'User does not exist',
        10007: 'Signatures do not match',
        10008: 'Illegal parameter',
        10009: 'Order does not exist',
        10010: 'Insufficient balance',
        10011: 'Order is less than minimum trade amount',
        10012: 'Unsupported symbol (not btc_usd or ltc_usd)',
        10013: 'This interface only accepts https requests',
        10014: 'Order price must be between 0 and 1,000,000',
        10015: 'Order price differs from current market price too much',
        10016: 'Insufficient coins balance',
        10017: 'API authorization error',
        10026: 'Loan (including reserved loan) and margin cannot be withdrawn',
        10027: 'Cannot withdraw within 24 hrs of authentication information modification',
        10028: 'Withdrawal amount exceeds daily limit',
        10029: 'Account has unpaid loan, please cancel/pay off the loan before withdraw',
        10031: 'Deposits can only be withdrawn after 6 confirmations',
        10032: 'Please enabled phone/google authenticator',
        10033: 'Fee higher than maximum network transaction fee',
        10034: 'Fee lower than minimum network transaction fee',
        10035: 'Insufficient BTC/LTC',
        10036: 'Withdrawal amount too low',
        10037: 'Trade password not set',
        10040: 'Withdrawal cancellation fails',
        10041: 'Withdrawal address not approved',
        10042: 'Admin password error',
        10100: 'User account frozen',
        10216: 'Non-available API',
        503: 'Too many requests (Http)'}

    if (!errorCodes[error_code])
    {
        return 'Unknown NovaExchange error code: ' + error_code
    }

    return( errorCodes[error_code] )
}

module.exports = NovaExchange
