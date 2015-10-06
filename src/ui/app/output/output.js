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
                start: session.absolute ? session.from : 0,
                end: session.absolute ? session.to : session.to - session.from,
                idx: 1,
                orfs: session.orfs,
                label: session.name,
                ticks: vm.displayed_grnas,
            };

            svgene.drawClusters('cluster', [cluster], 50, 1100);
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

    $scope.$on('$destroy', function(){
        if (angular.isDefined(stop)) {
            $timeout.cancel(stop);
        }
    });
}]);
})();
