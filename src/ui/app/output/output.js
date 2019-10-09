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

    function download() {
        var id_list = Object.keys(cart.getIds());
        $http.post('/api/v1.0/crispr/'+$stateParams.id, {ids: id_list})
            .then(function success(response){
                console.log(response.data.uri);
                $window.open(response.data.uri, "_self");
        }, function error(response){
            $window.alert('Failed to contact server: ' + response.statusText);
        });
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
    vm.mode = "CtoT";

    $scope.tickHover = tickHover;
    $scope.forDownload = forDownload;
    $scope.backToOverview = backToOverview;
    $scope.updateGrnas = updateGrnas;

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
            filterGrnas();

            vm.cluster = {
                start: 0,
                end: session.to - session.from,
                idx: 1,
                orfs: session.orfs,
                label: session.name,
                ticks: vm.displayed_grnas,
            };

            svgene.drawClusters('cluster', [vm.cluster], 50, 1100, session.best_size, session.best_offset);
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
        vm.displayed_grnas = [];
        var new_grnas = [];
        for (var tick_id in vm.grnas){
            var grna = vm.grnas[tick_id];
            if (vm.best && (!grna.can_edit || !grna.can_edit[vm.mode])) {
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
            new_grnas.push(grna);
        }
        new_grnas.sort(qualityRank);
        if (new_grnas.length > 1000) {
            new_grnas = new_grnas.slice(0, 1000);
        }
        vm.displayed_grnas = new_grnas;
    }

    function updateGrnas() {
        filterGrnas();
        vm.cluster.ticks = vm.displayed_grnas;
        svgene.drawClusters('cluster', [vm.cluster], 50, 1100);
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
