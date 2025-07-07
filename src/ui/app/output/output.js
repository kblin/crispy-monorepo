'use strict';

(function(){

var app = angular.module('crispy.output', [
    'ui.bootstrap',
    'ui.router',
]);

app.factory('Crispr', ['$resource', function($resource) {
    return $resource('/api/v1.0/crispr/:id', {id: '@id'});
}]);

app.service('cart', function Cart() {
    var cart = this;
    cart.add = add;
    cart.remove = remove;
    cart.has = has;
    cart.length = getLength;
    cart.getIds = getIds;
    cart.clear = clear;

    var length = 0;
    var selected_grnas = {};

    function add(id, val) {
        if (!selected_grnas[id]) {
            selected_grnas[id] = val;
            length += 1;
        }
    }

    function remove(id) {
        if (selected_grnas[id]) {
            delete selected_grnas[id];
            length -= 1;
        }
    }

    function has(id) {
        return selected_grnas[id];
    }

    function getLength() {
        return length;
    }

    function getIds() {
        return selected_grnas;
    }

    function clear() {
        selected_grnas = {};
        length = 0;
    }
});

app.controller('CartController', ['$state', '$stateParams', 'cart',
                                 function($state, $stateParams, cart) {
    var vm = this;
    vm.cart = cart;
    vm.download = download;

    function download() {

        $state.go('download', {id: $stateParams.id});
    }
}]);

app.controller('DownloadController', ['$stateParams', '$http', '$window', 'cart',
                                     function($stateParams, $http, $window, cart) {
    var vm = this;
    vm.cart = cart;
    vm.download = download;
    vm.firstKey = Object.keys(cart.getIds())[0];  // 获取第一个 key
    vm.if_CRISi = cart.getIds()[vm.firstKey]["CRISPRi_flag"];
    console.log(cart.getIds(),'=======');

    function download() {
        try {
            //  获取所有选中ID及其数据（保持原有cart.getIds()结构）
            const selectedItems = cart.getIds();
            const selectedIds = Object.keys(selectedItems);

            // Construct the request data (keep the original payload structure and add only the necessary fields)
            const payload = {
                crispri_flag: vm.if_CRISi,
                ids: selectedIds,
                grna_data: {}  // New: Store CRISPRi_score for each gRNA
            };

            // Add CRISPRi_score for each selected gRNA (minimal change)
            selectedIds.forEach(id => {
                payload.grna_data[id] = {
                    CRISPRi_score: selectedItems[id].CRISPRi_score
                };
            });

            $http.post('/api/v1.0/crispr/' + $stateParams.id, payload)
                .then(response => {
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'crispr-results.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error('Download failed:', error);
                    alert('Download failed: ' + (error.data || error.statusText));
                });
        } catch (error) {
            console.error('Download processing error:', error);
            alert('Error processing download request');
        }
    }
}]);

app.controller('FancyBackController', ['$stateParams', '$state', '$http', '$window',
                                      function($stateParams, $state, $http, $window) {
    var vm = this;
    vm.back = back;


    function back() {
        $http.get('/api/v1.0/crispr/'+$stateParams.id)
            .then(function (response) {
                var session = response.data;
                if (session.derived) {
                    $window.history.back();


                    return;
                }
                $http.put('/api/v1.0/genome/' + $stateParams.id + '/loaded')
                    .then(function (response){
                        $state.go('overview', {id: $stateParams.id});
                        $window.location.reload();
                });
        }, function error(response){
            $window.alert('Failed to contact server: ' + response.statusText)
        });
    }
}]);

app.controller('OutputController', ['$scope', '$state', '$stateParams', '$http', '$timeout', '$window', 'Crispr', 'cart',
                                   function($scope, $state, $stateParams, $http, $timeout, $window, Crispr, cart) {
    var vm = this;
    vm.session = {};

    vm.grnas = {};
    vm.displayed_grnas = [];

    vm.cart = cart;
    vm.best = false;
    vm.stops_only = false;
    vm.mode = "ALL";
    //2024/10/22;
    vm.crisi = false;
    vm.crisprimode = "ALL";
    //2025-03-09;
    vm.if_tnpb = false;
    vm.selectedORF = 'All';
    //2025/04/28
    vm.sortby1bp = false;
    vm.sortby2bp = false;
    vm.sortby0bp = false;
    vm.sortbyscore = true;
    //2025/05/13
    vm.sortbyTnpB1bp = true;
    vm.sortbyTnpB0bp = false;
    vm.sortbyTnpB2bp = false;
    //2025/05/20
    vm.sortbycrispri = false;


    $scope.tickHover = tickHover;
    $scope.forDownload = forDownload;
    $scope.backToOverview = backToOverview;
    $scope.updateGrnas = updateGrnas;
    $scope.download = download;
    $scope.sortby1bp = sortby1bp;
    $scope.sortby2bp = sortby2bp;
    $scope.sortby0bp = sortby0bp;
    //2025/05/13
    $scope.sortbyTnpB1bp = sortbyTnpB1bp;
    $scope.sortbyTnpB2bp = sortbyTnpB2bp;
    $scope.sortbyTnpB0bp = sortbyTnpB0bp;

    //2025/05/20
    vm.firsttime = true;


    var session = Crispr.get({id: $stateParams.id}, getCrisprs, handleError);


    var stop = undefined;

    function getCrisprs() {
        vm.session = session;



        function update() {
            session = Crispr.get({id: $stateParams.id}, getCrisprs, handleError);


        }

        if (session.state == 'scanning') {
            stop = $timeout(update, 5000);
            return;
        }

        if (session.state == 'loaded') {
            $state.go('overview', {id: $stateParams.id});
            return;
        }

        if (session.state == 'error') {
            return;
        }

        if (session.state == 'done') {
            cart.clear();
            vm.grnas = session.grnas;
            // console.log(session);
            filterGrnas();

            // console.log("session========================",session);
        const firstKey = Object.keys(session.grnas)[0]; // 获取第一个键
        const firstValue = session.grnas[firstKey]; // 获取对应的值
        if(firstValue.pam != "NNN"){
            session.if_tnpb = false;
        }else {
            session.if_tnpb = true;
        }

            vm.cluster = {
                start: 0,
                end: session.to - session.from,
                idx: 1,
                orfs: session.orfs,
                label: session.name,
                ticks: vm.displayed_grnas,
            };
            console.log(session);
            svgene.drawClusters('cluster', [vm.cluster], 50, 1100, session.best_size, session.best_offset,session.if_tnpb);
            $timeout(hilight, 1000);
        }
    }

    function hilight() {
        $(".svgene-row").mouseover(function(e) {
            var tick = $(this).attr('id').replace('-row', '-tick');
            var class_str = $('#'+tick).attr('class') + ' active';
            $('#'+tick).attr('class', class_str);
            d3.select('#'+tick).toFront();
        }).mouseout(function(e) {
            var tick = $(this).attr('id').replace('-row', '-tick');
            var class_str = $('#'+tick).attr('class').replace(/ active/, '');
            $('#'+tick).attr('class', class_str);
        }).click(function(e) {
            var id = $(this).attr('id').replace('-row', '');
            var tick = '#' + id + '-tick';
            if (cart.has(id)) {
                var class_str = $(tick).attr('class') + ' selected';
                $(tick).attr('class', class_str);
            } else {
                var class_str = $(tick).attr('class').replace(/ selected/, '');
                $(tick).attr('class', class_str);
            }
        });
    }

    function filterGrnas(){

        console.log("session_best_size================================",session.best_size)

        var control = 0;

        vm.displayed_grnas = [];
        vm.uniqueORFs = [];
        vm.crisi_rnas = [];
        // console.log('orf is:',session.orfs);
        // console.log("crisi is",vm.crisi);
        // console.log("orf is",vm.selectedORF);
        var new_grnas = [];

        for (var tick_id in vm.grnas){

            var grna = vm.grnas[tick_id];
            grna.CRISPRi_flag = false;
            


            if (!vm.uniqueORFs.includes(grna.orf)) {
                if(vm.best){
                    if (grna.orf=="-"){continue}else{vm.uniqueORFs.push(grna.orf);}
                }else if(vm.crisi &&vm.crisprimode=="ORF"){
                    if (grna.orf=="-"){continue}
                    else{vm.uniqueORFs.push(grna.orf);}
                }
                else{vm.uniqueORFs.push(grna.orf);}
                }
            // console.log("grna.tnpb_Seq",grna.tnpb_Seq);
            if(grna.tam == "TTGAT" && grna.tnpb_Seq != "NNNNN"){
                // console.log("This is TnpB");
                vm.if_tnpb = true;
            }



            //CRISPR BEST ALL
            if(vm.best && vm.mode == "ALL"){
                if(grna.changed_aas["CtoT"]&&grna.changed_aas["AtoG"]){
                // console.log("length===================",grna.changed_aas["CtoT"].concat(grna.changed_aas["AtoG"]).length);
                if(grna.changed_aas["CtoT"].concat(grna.changed_aas["AtoG"]).length==0){continue;}
                grna.changed_aas["ALL"] = grna.changed_aas["CtoT"].concat(grna.changed_aas["AtoG"]);}
                else if(grna.changed_aas["CtoT"]&&!grna.changed_aas["AtoG"]){grna.changed_aas["ALL"]=grna.changed_aas["CtoT"];if(grna.changed_aas["ALL"].length==0){continue}}
                else if(!grna.changed_aas["CtoT"]&&grna.changed_aas["AtoG"]){grna.changed_aas["ALL"]=grna.changed_aas["AtoG"];if(grna.changed_aas["ALL"].length==0){continue}}
            }



            //CRISPR BEST CtoT/AtoG
            if(vm.best && vm.mode=="CtoT"){
                if (grna.changed_aas["CtoT"]) {
                    grna.CtoT = grna.changed_aas["CtoT"].join(' ')
                }
            }
            else if(vm.best && vm.mode=="AtoG"){
                if (grna.changed_aas["AtoG"]){grna.AtoG = grna.changed_aas["AtoG"].join(' ')}
            }
            if (vm.best && (!grna.can_edit || !grna.can_edit[vm.mode]) && vm.mode!="ALL") {
                console.log("we stoped here");
                continue;
            }
            if (vm.stops_only && vm.mode == "CtoT") {
                var found = false;
                if (!grna.changed_aas[vm.mode]) {
                    continue;
                }
                for (var changed_aa of grna.changed_aas[vm.mode]) {

                    if (changed_aa[changed_aa.length - 1] == "*") {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    continue;
                }
            }



            //CRISPRi ALL
            if(vm.crisi && vm.crisprimode == "ALL"){
                var foundi = false;
                grna.CRISPRi_flag = true;
                for (var orf of session.orfs){
                    if(grna.orf == orf.locus_tag &&orf.strand*grna.strand < 0){
                    if(orf.strand == 1){
                        var distance = Math.abs(grna.end - orf.start);
                        var total_length = Math.abs(orf.end - orf.start);
                        var scale = 1 - distance/total_length;
                        if(vm.firsttime){
                        grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*scale).toFixed(1));
                        grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}
                        foundi = true;
                    }

                    else if(grna.orf == orf.locus_tag && orf.strand == -1){
                        var distance = Math.abs(grna.end - orf.end);
                        var total_length = Math.abs(orf.end - orf.start);
                        var scale = 1 - distance/total_length;
                        if(vm.firsttime){
                        grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*scale).toFixed(1));
                        grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}
                        foundi = true;
                    }

                }
                    if(grna.orf == "-" && orf.strand == 1){
                        // console.log("???");
                        var distance = Math.abs(orf.start - grna.end);
                        if(distance <= 100){

                            if(vm.firsttime){
                            grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*(1- distance/100)).toFixed(1));

                            grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}

                            foundi = true;
                            grna.Hyper = "5'UTR";
                        }
                    }
                    if(grna.orf == "-" && orf.strand == -1){
                        var distance = Math.abs(orf.end - grna.end);
                        if(distance <= 100){
                            // console.log(grna.CRISPRi_score);
                            if(vm.firsttime){
                            grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*(1- distance/100)).toFixed(1));

                            grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}

                            foundi = true;
                            grna.Hyper = "5'UTR";
                        }
                    }
                }
                if(!foundi){
                    continue;
                }
            }
            //CRISPRi ORF
            if(vm.crisi && vm.crisprimode == "ORF"){
                grna.CRISPRi_flag = true;
                var foundi = false;
                for(var orf of session.orfs){
                if(grna.orf == orf.locus_tag &&orf.strand*grna.strand < 0){
                    if(orf.strand == 1){
                        var distance = Math.abs(grna.end - orf.start);
                        var total_length = Math.abs(orf.end - orf.start);
                        var scale = 1 - distance/total_length;
                        if(vm.firsttime){
                        grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*scale).toFixed(1));
                        grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}
                        foundi = true;
                    }

                    else if(grna.orf == orf.locus_tag && orf.strand == -1){
                        var distance = Math.abs(grna.end - orf.end);
                        var total_length = Math.abs(orf.end - orf.start);
                        var scale = 1 - distance/total_length;
                        if(vm.firsttime){
                        grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*scale).toFixed(1));
                        grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}
                        foundi = true;
                    }

                }

            }
            if(!foundi){
                    continue;
                }}

            if(vm.crisi && vm.crisprimode == "Hyper"){
                grna.CRISPRi_flag = true;
                var foundi = false;
                for(var orf of session.orfs){
                    if(grna.orf == "-" && orf.strand == 1){
                        // console.log("???");
                        var distance = Math.abs(orf.start - grna.end);
                        if(distance <= 100){
                            if(vm.firsttime){
                            grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*(1- distance/100)).toFixed(1));

                            grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}

                            foundi = true;
                            grna.Hyper = "5'UTR";
                        }
                    }
                    if(grna.orf == "-" && orf.strand == -1){
                        var distance = Math.abs(orf.end - grna.end);
                        if(distance <= 100){
                            // console.log(grna.CRISPRi_score);
                            if(vm.firsttime){
                            grna.CRISPRi_score = parseFloat((grna.CRISPRi_score*(1- distance/100)).toFixed(1));

                            grna.CRISPRi_score = Number.isInteger(grna.CRISPRi_score) ? grna.CRISPRi_score.toFixed(1) : parseFloat(grna.CRISPRi_score.toFixed(1));}

                            foundi = true;
                            grna.Hyper = "5'UTR";
                        }
                    }
            }
            if(!foundi){
                    continue;
                }}

            if(grna.strand == 1){
                            grna.direc = "T";
                        }
                        if(grna.strand == -1){
                            grna.direc = "NT";
                        }

            if(vm.selectedORF == "All" || vm.selectedORF==grna.orf){
                new_grnas.push(grna);
           }
        }

        console.log('grna is:',grna);
        // console.log(new_grnas,"new_grnas");
        // if(!vm.if_tnpb){
        // if(vm.sortbyscore){
        //     console.log("sortbyscore");
        //     new_grnas.sort(scoreRank);
        //     vm.sortby0bp = false;
        //     vm.sortby1bp = false;
        //     vm.sortby2bp = false;
        // }else if(vm.sortby0bp){
        //     new_grnas.sort(sortby0bp);
        //     vm.sortby1bp = false;
        //     vm.sortby2bp = false;
        //     vm.sortbyscore = false;
        // }else if(vm.sortby1bp){
        //     console.log("sortby1bp");
        //     new_grnas.sort(sortby1bp);
        //     vm.sortby0bp = false;
        //     vm.sortby2bp = false;
        //     vm.sortbyscore = false;
        // }else if(vm.sortby2bp){
        //     new_grnas.sort(sortby2bp);
        //     vm.sortby1bp = false;
        //     vm.sortby0bp = false;
        //     vm.sortbyscore = false;
        // }
        new_grnas.sort(qualityRank);
        console.log("log");
        // }else{
        //     if(vm.sortbyTnpB1bp){new_grnas.sort(sortbyTnpB1bp);}
        //     else if(vm.sortbyTnpB2bp){new_grnas.sort(sortbyTnpB2bp)}
        //     else if(vm.sortbyTnpB0bp){new_grnas.sort(sortbyTnpB0bp)}
        // }
        console.log(new_grnas.length,"length============================================================================================");
        // console.log(new_grnas);
        if (new_grnas.length > 1000) {
            new_grnas = new_grnas.slice(0, 1000);
            
        }
                if(!vm.if_tnpb){
        if(vm.sortbyscore){
            console.log("sortbyscore");
            new_grnas.sort(scoreRank);
            vm.sortby0bp = false;
            vm.sortby1bp = false;
            vm.sortby2bp = false;
        }else if(vm.sortby0bp){
            new_grnas.sort(sortby0bp);
            vm.sortby1bp = false;
            vm.sortby2bp = false;
            vm.sortbyscore = false;
        }else if(vm.sortby1bp){
            console.log("sortby1bp");
            new_grnas.sort(sortby1bp);
            vm.sortby0bp = false;
            vm.sortby2bp = false;
            vm.sortbyscore = false;
        }else if(vm.sortby2bp){
            new_grnas.sort(sortby2bp);
            vm.sortby1bp = false;
            vm.sortby0bp = false;
            vm.sortbyscore = false;
        }
        
        console.log("log");
        }else{
            if(vm.sortbyTnpB1bp){new_grnas.sort(sortbyTnpB1bp);}
            else if(vm.sortbyTnpB2bp){new_grnas.sort(sortbyTnpB2bp)}
            else if(vm.sortbyTnpB0bp){new_grnas.sort(sortbyTnpB0bp)}
        }
        vm.displayed_grnas = new_grnas;
    }

    function updateGrnas() {
        // console.log("updateGrnas===")
        if(!vm.best){
            vm.stops_only = false;

        };
        if(!vm.crisi){
          vm.crisprimode = "ALL";

        };
        filterGrnas();
        vm.cluster.ticks = vm.displayed_grnas;
        svgene.drawClusters('cluster', [vm.cluster], 50, 1100);
        console.log(vm.crisprimode);
        $timeout(hilight, 1000);
    }

    function qualityRank(a, b){
        var parameters = ['0bpmm', '1bpmm', '2bpmm', '3bpmm'];
        for (var i in parameters) {
             var res = a[parameters[i]] - b[parameters[i]];
            if (res != 0) {
                return res;
            }
        }
        return a['start'] - b['start'];
    }
        function scoreRank(a, b){
            if(!vm.crisi){
            if (parseFloat(a.Mix_Score) != parseFloat(b.Mix_Score)){
                return parseFloat(-a['Mix_Score']) + parseFloat(b['Mix_Score']);
        }
            var parameters = ['0bpmm', '1bpmm', '2bpmm', '3bpmm'];
        for (var i in parameters) {
             var res = a[parameters[i]] - b[parameters[i]];
            if (res != 0) {
                return res;
            }
        }}
            else{
                if (parseFloat(a.CRISPRi_score) != parseFloat(b.CRISPRi_score)){
                return parseFloat(-a['CRISPRi_score']) + parseFloat(b['CRISPRi_score']);
        }
            var parameters = ['0bpmm', '1bpmm', '2bpmm', '3bpmm'];
        for (var i in parameters) {
             var res = a[parameters[i]] - b[parameters[i]];
            if (res != 0) {
                return res;
            }
        }
            }
        return a['start'] - b['start'];

    }

    //By Sihan Yang 2025/04/28 SortBy1bp
    function sortby1bp(a,b) {
        var res = a['1bpmm'] - b['1bpmm']
        if (res!=0){return res}
        if(vm.crisi){
        return parseFloat(-a['CRISPRi_score']) + parseFloat(b['CRISPRi_score'])};
        return parseFloat(-a['Mix_Score']) + parseFloat(b['Mix_Score']);
    }
    //By Sihan Yang 2025/04/28 SortBy2bp
    function sortby2bp(a,b) {
        var res = a['2bpmm'] - b['2bpmm']
        if (res!=0){return res}
        if(vm.crisi){
        return parseFloat(-a['CRISPRi_score']) + parseFloat(b['CRISPRi_score'])};
        return parseFloat(-a['Mix_Score']) + parseFloat(b['Mix_Score']);
    }
        //By Sihan Yang 2025/04/28 SortBy0bp
    function sortby0bp(a,b) {
        var res = a['0bpmm'] - b['0bpmm']
        if (res!=0){return res}
        if(vm.crisi){
        return parseFloat(-a['CRISPRi_score']) + parseFloat(b['CRISPRi_score'])};
        return parseFloat(-a['Mix_Score']) + parseFloat(b['Mix_Score']);

    }
    //By Sihan Yang 2025/05/20 SortByCrispri

    //2025/05/13 by Yang
    function sortbyTnpB1bp(a,b) {
        var res = a['1bpmm'] - b['1bpmm']
        if (res!=0){return res}
        return a['start'] - b['start'];
    }

    function sortbyTnpB2bp(a,b) {
        var res = a['2bpmm'] - b['2bpmm']
        if (res!=0){return res}
        return a['start'] - b['start'];
    }


    function sortbyTnpB0bp(a,b) {
        var res = a['0bpmm'] - b['0bpmm']
        if (res!=0){return res}
        return a['start'] - b['start'];
    }


    function tickHover(tick_id) {
        console.log("Hovering over " + tick_id);
    }

    function forDownload(id) {
        if (!cart.has(id)) {
            cart.add(id, vm.grnas[id]);
        } else {
            cart.remove(id);
        }
    }

    function backToOverview() {
        cart.clear();
        if (session.derived) {
            $window.history.back();
            return;
        }
        $http.put('/api/v1.0/genome/' + $stateParams.id + '/loaded')
            .then(function susscess(response){
                $state.go('overview', {id: $stateParams.id});
        }, handleError);
    }

    function handleError(response) {
        $window.alert('Failed to contact server: ' + response.statusText);
    }


function download() {
    // Assuming vm.displayed_grnas is an array where each element is an object representing a row of data.
    const data = vm.displayed_grnas;
    console.log(data[0]);

    // Define the column headers of the CSV file
    let headers = ["Start", "End", "Strand", "ORF", "Sequence", "PAM", "1 bp", "2 bp", "exact match", "Score"];
    let real_headers = ["start", "end", "strand", "orf", "sequence", "pam", "1bpmm", "2bpmm", "0bpmm", "Mix_Score"];

    if (vm.crisi && !vm.if_tnpb) {
        console.log("this is crisi==================================================");
        headers = ["Start", "End", "Strand", "ORF", "Sequence", "PAM", "1 bp", "2 bp", "exact match", "CRISPRi_Score"];
        real_headers = ["start", "end", "strand", "orf", "sequence", "pam", "1bpmm", "2bpmm", "0bpmm", "CRISPRi_score"];
    } else if (vm.best && !vm.if_tnpb) {
        if (vm.mode === "CtoT") {
            headers = ["Start", "End", "Strand", "ORF", "Sequence", "PAM", "Mutations", "1 bp", "2 bp", "exact match", "Score"];
            real_headers = ["start", "end", "strand", "orf", "sequence", "pam", "CtoT", "1bpmm", "2bpmm", "0bpmm", "Mix_Score"];
        } else if (vm.mode !== "CtoT") {
            headers = ["Start", "End", "Strand", "ORF", "Sequence", "PAM", "Mutations", "1 bp", "2 bp", "exact match", "Score"];
            real_headers = ["start", "end", "strand", "orf", "sequence", "pam", "AtoG", "1bpmm", "2bpmm", "0bpmm", "Mix_Score"];
        }
    } else if (vm.if_tnpb) {
        headers = ["Start", "End", "Strand", "ORF", "PAM", "Sequence", "1 bp", "2 bp", "exact match"];
        real_headers = ["start", "end", "strand", "orf", "tam", "sequence", "1bpmm", "2bpmm", "0bpmm"];
    }

    // Create an array that includes column headers
    const csvRows = [headers.join(',')];

    // Traverse the data and convert each row to CSV format.
    data.forEach(row => {
        console.log("row==========", row);

        // Find the index of 0bpmm
        const zeroBpmmIndex = real_headers.indexOf("0bpmm");

        // If 0bpmm column is found
        if (zeroBpmmIndex !== -1) {
            // Add 1 to the value of 0bpmm.
            const zeroBpmmValue = row[real_headers[zeroBpmmIndex]];
            if (zeroBpmmValue !== undefined && zeroBpmmValue !== null) {
                row[real_headers[zeroBpmmIndex]] = (parseInt(zeroBpmmValue, 10) + 1).toString();
            }
        }

        //Convert the data of each row into CSV format.
        const values = real_headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    });

    // Convert CSV data to a string
    const csvString = csvRows.join('\n');

    // Create a Blob object to generate a download link.
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'grnas.csv'; 

    
    link.click();

    
    URL.revokeObjectURL(link.href);
}




    $scope.$on('$destroy', function(){
        if (angular.isDefined(stop)) {
            $timeout.cancel(stop);
        }
    });
    $scope.$on('$viewContentLoaded', function(){
        $timeout(function hilight_ticks() {
            for(var i in vm.displayed_grnas) {
                var id = vm.displayed_grnas[i].id;
                if (cart.has(id)) {
                    var tick = '#' + id + '-tick';
                    var class_str = $(tick).attr('class').replace(/ selected/, '') + ' selected';
                    $(tick).attr('class', class_str);
                    d3.select(tick).toFront();
                }
            }
        }, 500);
    });
}]);
})();
