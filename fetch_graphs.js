#!/usr/bin/env phantomjs

// CONFIG SECTION START -----------------------------------

var base_uri = 'http://totempole-a.stuff.catalyst.net.nz/';

function standard_elb(){
    return ['ELB: Request Count']
}

function standard_web(){
    return ['CPU Usage', 'Load', 'Disk Requests xvdb', 'Disk Usage var-log', 'Interface eth0', 'Memory Usage']
}

function standard_asset(){
    return standard_web().concat(['Disk Requests xvdc', 'Disk Usage var-lib']);
}

function standard_rds(){
    return ['RDS: CPU Usage', 'RDS: Database Connections', 'RDS: RAM available']
}

var targets = [
    { host: 'stuff-prod-web',     graphs: standard_elb() },
    { host: 'stuff-prod-asset',   graphs: standard_elb() },
    { host: 'stuff-prod-adclick', graphs: standard_elb() },
    { host: 'stuff-prod-db2',     graphs: standard_rds() },
    { host: 'stuff-prod-web-a1_stuff_catalyst_net_nz',        graphs: standard_web() },
    { host: 'stuff-prod-adclick-a1_stuff_catalyst_net_nz',    graphs: standard_web() },
    { host: 'stuff-prod-asset-a1_stuff_catalyst_net_nz',      graphs: standard_asset() },
    { host: 'stuff-prod-cma-a1_stuff_catalyst_net_nz',        graphs: standard_web() },
];

// CONFIG SECTION END -------------------------------------


function make_uri(host, from, until, graph){
    return base_uri + '?' +
           'hostname=' + host + '&' +
           'from=' + from + '&' +
           'until=' + until + '&' +
           'graphs=^' + encodeURIComponent(graph) + '$';
}

// From/until should default to the previous month
var date_range = (function(){
    var d = new Date();
    d.setDate(1);
    d.setMonth(5);
    var until = d.getTime()/1000;
    var prev_month = d.getMonth();
    d.setMonth(prev_month == 0 ? 11 : prev_month - 1);
    var from = d.getTime()/1000;
    return {
        from:  from|0,
        until: until|0
    };
})();

console.log('Date range is ' + JSON.stringify(date_range));

var outstanding_requests = 0;

function get_target_graphs(host, graphs, next){
    var g = graphs.shift();
    if (!g){
        next && next();
        return;
    }
    console.log('  - ' + g);
    outstanding_requests++;
    var page = require('webpage').create();

    var uri = make_uri(host, date_range.from, date_range.until, g);
    console.log('     `- ' + uri);
    page.open(uri, function() {
        page.evaluate(function(){
            document.getElementById('hostTree-wrap').style.display = 'none';
            document.getElementById('filters').style.display = 'none';
            document.querySelector('.page-header').style.display = 'none';
            document.querySelector('.row').style.display = 'none';
            var btns = document.querySelectorAll('.btn');
            for (var i = 0; i < btns.length; ++i){
                btns[i].style.display = 'none';
            }
        });
        setTimeout(function(){
            page.render('images/' + host + ' ' + g + '.png');
            outstanding_requests--;
            get_target_graphs(host, graphs, next);
        }, 100);
    });
}

function process_targets(){
    var t = targets.shift();
    if (!t){
        setTimeout(cleanup, 250);
        return;
    }
    console.log(t.host);
    get_target_graphs(t.host, t.graphs, process_targets);
}

function cleanup(){
    console.log(outstanding_requests + ' outstanding...');
    if (outstanding_requests > 0){
        setTimeout(cleanup, 1000);
        return;
    }
    phantom.exit();
}

process_targets();
