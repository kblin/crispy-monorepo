'use strict';

(function(){

var app = angular.module('crispy.input', [
    'ngFileUpload',
]);

app.controller('InputController', ['$scope', 'Upload', '$timeout', '$state', '$http',
                                   function($scope, Upload, $timeout, $state, $http) {
    var vm = this;
    vm.asID = "";
    vm.file = "";
    vm.uploadGbk = uploadGbk;
    vm.submitIdForm = submitIdForm;
    vm.error = "";
    vm.news = [];

    $http.get('/api/v1.0/news').then(function(response){
        vm.news = response.data.entries.slice(0, 3);
    });

    function switchToOverview(response) {
            console.log(response.data);
            var uri = response.data.uri;
            var id = response.data.id;
            console.log('Switching to ' + uri + '/' + id);
            $state.go('overview', {uri: uri, id: id});
    };

    function uploadGbk(file) {
        console.log(file);
        file.upload = Upload.upload({
            url: '/api/v1.0/seqs/file',
            data: {gbk: file},
        });

        file.upload.then(switchToOverview, handleError);
    };

    function submitIdForm() {
        $http.post('/api/v1.0/seqs/id', {asID: vm.asID})
            .then(switchToOverview, handleError);
    };

    function handleError(response) {
        console.log(response);
        vm.error = response.statusText;
    }
}]);

})();
