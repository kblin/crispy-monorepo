'use strict';

(function(){

var app = angular.module('crispy.output', [
    'ui.router',
]);

app.factory('Crispr', ['$resource', function($resource) {
    return $resource('/api/v1.0/crispr/:id', {id: '@id'});
}]);

app.controller('OutputController', ['$scope', '$state', '$stateParams', '$http', '$timeout', 'Crispr',
                                   function($scope, $state, $stateParams, $http, $timeout, Crispr) {
    var vm = this;
    vm.session = {};

    vm.grnas = {};
    vm.displayed_grnas = [];
    vm.selected_grnas = {};

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

            console.log(vm.displayed_grnas);

            var cluster = {
                start: 0,
                end: session.to - session.from,
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
        if (!vm.selected_grnas[id]) {
            vm.selected_grnas[id] = vm.grnas[id];
        } else {
            delete vm.selected_grnas[id];
        }
    }

    $scope.$on('$destroy', function(){
        if (angular.isDefined(stop)) {
            $timeout.cancel(stop);
        }
    });
}]);
})();
