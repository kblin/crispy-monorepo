'use strict';

(function(){

var app = angular.module('crispy.output', [
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

    function download() {
        var id_list = Object.keys(cart.getIds());
        $http.post('/api/v1.0/crispr/'+$stateParams.id, {ids: id_list})
            .then(function (response){
                console.log(response.data.uri);
                $window.open(response.data.uri, "_self");
        });
    }
}]);

app.controller('OutputController', ['$scope', '$state', '$stateParams', '$http', '$timeout', 'Crispr', 'cart',
                                   function($scope, $state, $stateParams, $http, $timeout, Crispr, cart) {
    var vm = this;
    vm.session = {};

    vm.grnas = {};
    vm.displayed_grnas = [];
    vm.cart = cart;

    $scope.tickHover = tickHover;
    $scope.forDownload = forDownload;
    $scope.backToOverview = backToOverview;

    var session = Crispr.get({id: $stateParams.id}, getCrisprs);
    var stop = undefined;

    function getCrisprs() {
        vm.session = session;

        function update() {
            session = Crispr.get({id: $stateParams.id}, getCrisprs);
        }

        if (session.state == 'scanning') {
            stop = $timeout(update, 5000);
            return;
        }

        if (session.state == 'loaded') {
            $state.go('overview', {id: $stateParams.id});
            return;
        }

        if (session.state == 'done') {
            vm.grnas = session.grnas;
            vm.displayed_grnas = [];
            for (var tick_id in vm.grnas){
                vm.displayed_grnas.push(vm.grnas[tick_id]);
            }
            vm.displayed_grnas.sort(qualityRank);
            if (vm.displayed_grnas.length > 1000) {
                vm.displayed_grnas = vm.displayed_grnas.slice(0, 1000);
            }

            var cluster = {
                start: 0,
                end: session.to - session.from,
                idx: 1,
                orfs: session.orfs,
                label: session.name,
                ticks: vm.displayed_grnas,
            };

            svgene.drawClusters('cluster', [cluster], 50, 1100);
            $timeout(function hilight() {
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
            }, 1000);

        }
    }

    function qualityRank(a, b){
        var res = a['2bpmm'] - b['2bpmm'];
        if (res != 0) {
            return res;
        }
        return a['3bpmm'] - b['3bpmm'];
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
        $http.put('/api/v1.0/genome/' + $stateParams.id + '/loaded')
            .then(function (response){
                $state.go('overview', {id: $stateParams.id});
        });
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
