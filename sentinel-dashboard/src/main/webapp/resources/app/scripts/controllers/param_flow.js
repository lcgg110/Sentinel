/**
 * Parameter flow control controller.
 * 
 * @author Eric Zhao
 */
angular.module('sentinelDashboardApp').controller('ParamFlowController', ['$scope', '$stateParams', 'ParamFlowService', 'ngDialog',
  'MachineService',
  function ($scope, $stateParams, ParamFlowService, ngDialog,
    MachineService) {
    const UNSUPPORTED_CODE = 4041;
    $scope.app = $stateParams.app;
    $scope.curExItem = {};

    $scope.paramItemClassTypeList = [
      "int", "double", "java.lang.String", "long", "float", "char", "byte", "boolean"
    ];

    $scope.rulesPageConfig = {
      pageSize: 10,
      currentPageIndex: 1,
      totalPage: 1,
      totalCount: 0,
    };
    $scope.macsInputConfig = {
      searchField: ['text', 'value'],
      persist: true,
      create: false,
      maxItems: 1,
      render: {
        item: function (data, escape) {
          return '<div>' + escape(data.text) + '</div>';
        }
      },
      onChange: function (value, oldValue) {
        $scope.macInputModel = value;
      }
    };

      function updateSingleParamItem(arr, v, t, c) {
          for (let i = 0; i < arr.length; i++) {
              if (arr[i].object === v) {
                  arr[i].classType = t;
                  arr[i].count = c;
                  return;
              }
          }
          arr.push({object: v, classType: t, count: c});
      }

      function removeSingleParamItem(arr, v, t) {
          for (let i = 0; i < arr.length; i++) {
              if (arr[i].object === v && arr[i].classType === t) {
                  arr.splice(i, 1);
                  break;
              }
          }
      }

      function isNumberClass(classType) {
        return classType === 'int' || classType === 'double' ||
            classType === 'float';
      }

      $scope.notValidParamItem = (curExItem) => {
        if (isNaN(curExItem.object) && isNumberClass(curExItem.classType)) {
           return true;
        }
          return curExItem.object === undefined || curExItem.classType === undefined ||
              curExItem.object === '' || curExItem.count === undefined || isNaN(curExItem.count) || curExItem.count < 0;
      };

      $scope.addParamItem = () => {
          updateSingleParamItem($scope.currentRule.rule.paramFlowItemList,
              $scope.curExItem.object, $scope.curExItem.classType, $scope.curExItem.count);
          $scope.curExItem = {};
      };

      $scope.removeParamItem = (v, t) => {
          removeSingleParamItem($scope.currentRule.rule.paramFlowItemList, v, t);
      };

    function getMachineRules() {
      if (!$scope.macInputModel) {
        return;
      }
      let mac = $scope.macInputModel.split(':');
      ParamFlowService.queryMachineRules($scope.app, mac[0], mac[1])
        .success(function (data) {
          if (data.code == 0 && data.data) {
            $scope.loadError = undefined;
            $scope.rules = data.data;
            $scope.rulesPageConfig.totalCount = $scope.rules.length;
          } else {
            $scope.rules = [];
            $scope.rulesPageConfig.totalCount = 0;
            if (data.code === UNSUPPORTED_CODE) {
              $scope.loadError = {message: "机器 " + mac[0] + ":" + mac[1] + " 的 Sentinel 客户端版本不支持热点参数限流功能，请升级至 0.2.0 以上版本并引入 sentinel-parameter-flow-control 依赖。"}
            } else {
              $scope.loadError = {message: data.msg}
            }
          }
        })
        .error((data, header, config, status) => {
          $scope.loadError = {message: "未知错误"}
        });
    };
    $scope.getMachineRules = getMachineRules;
    getMachineRules();

    var paramFlowRuleDialog;

    $scope.editRule = function (rule) {
      $scope.currentRule = rule;
      $scope.paramFlowRuleDialog = {
        title: '编辑热点规则',
        type: 'edit',
        confirmBtnText: '保存',
        showAdvanceButton: rule.controlBehavior == 0 && rule.strategy == 0
      };
      paramFlowRuleDialog = ngDialog.open({
        template: '/app/views/dialog/param-flow-rule-dialog.html',
        width: 680,
        overlay: true,
        scope: $scope
      });
      $scope.curExItem = {};
    };

    $scope.addNewRule = function () {
      var mac = $scope.macInputModel.split(':');
      $scope.currentRule = {
        app: $scope.app,
        ip: mac[0],
        port: mac[1],
        rule: {
          blockGrade: 1,
          paramFlowItemList: [],
          count: 0,
          limitApp: 'default',
        }
      };
      $scope.paramFlowRuleDialog = {
        title: '新增热点规则',
        type: 'add',
        confirmBtnText: '新增',
        showAdvanceButton: true,
      };
      paramFlowRuleDialog = ngDialog.open({
        template: '/app/views/dialog/param-flow-rule-dialog.html',
        width: 680,
        overlay: true,
        scope: $scope
      });
      $scope.curExItem = {};
    };

    function checkRuleValid(rule) {
      if (!rule.resource || rule.resource === '') {
        alert("资源名称不能为空");
        return false;
      }
      if (rule.blockGrade !== 1) {
        alert("未知的限流模式");
        return false;
      }
      if (rule.count < 0) {
        alert("限流阈值必须大于等于 0");
        return false;
      }
      if (rule.paramIdx === undefined || rule.paramIdx === '' || isNaN(rule.paramIdx)) {
        alert("热点参数索引不合法");
        return false;
      }
      return true;
    }

    $scope.saveRule = function () {
      if (!checkRuleValid($scope.currentRule.rule)) {
        return;
      }
      if ($scope.paramFlowRuleDialog.type === 'add') {
        addNewRuleAndPush($scope.currentRule);
      } else if ($scope.paramFlowRuleDialog.type === 'edit') {
        saveRuleAndPush($scope.currentRule, true);
      }
    };

    function addNewRuleAndPush(rule) {
      ParamFlowService.addNewRule(rule).success((data) => {
        if (data.success) {
          getMachineRules();
          paramFlowRuleDialog.close();
        } else {
          alert('添加规则失败：' + data.msg);
        }
      }).error((data) => {
        if (data) {
          alert('添加规则失败：' + data.msg);
        } else {
          alert("添加规则失败：未知错误");
        }
      });
    };

    function saveRuleAndPush(rule, edit) {
      ParamFlowService.saveRule(rule).success(function (data) {
        if (data.success) {
          alert("修改规则成功");
          getMachineRules();
          if (edit) {
            paramFlowRuleDialog.close();
          } else {
            confirmDialog.close();
          }
        } else {
          alert('修改规则失败：' + data.msg);
        }
      }).error((data) => {
        if (data) {
          alert('修改规则失败：' + data.msg);
        } else {
          alert("修改规则失败：未知错误");
        }
      });
    }

    function deleteRuleAndPush(entity) {
      if (entity.id === undefined || isNaN(entity.id)) {
        alert('规则 ID 不合法！');
        return;
      }
      ParamFlowService.deleteRule(entity).success((data) => {
        if (data.code == 0) {
          getMachineRules();
          confirmDialog.close();
        } else {
          alert('删除规则失败：' + data.msg);
        }
      }).error((data) => {
        if (data) {
          alert('删除规则失败：' + data.msg);
        } else {
          alert("删除规则失败：未知错误");
        }
      });
    };

    var confirmDialog;
    $scope.deleteRule = function (rule) {
      $scope.currentRule = rule;
      $scope.confirmDialog = {
        title: '删除热点规则',
        type: 'delete_rule',
        attentionTitle: '请确认是否删除如下热点参数限流规则',
        attention: '资源名: ' + rule.resource + ', 热点参数索引: ' + rule.paramIdx
          + ', 限流模式: ' + (rule.blockGrade == 1 ? 'QPS' : '未知') + ', 限流阈值: ' + rule.count,
        confirmBtnText: '删除',
      };
      confirmDialog = ngDialog.open({
        template: '/app/views/dialog/confirm-dialog.html',
        scope: $scope,
        overlay: true
      });
    };

    $scope.confirm = function () {
      if ($scope.confirmDialog.type == 'delete_rule') {
        deleteRuleAndPush($scope.currentRule);
      } else {
        console.error('error');
      }
    };

    queryAppMachines();

    function queryAppMachines() {
      MachineService.getAppMachines($scope.app).success(
        function (data) {
          if (data.code == 0) {
            // $scope.machines = data.data;
            if (data.data) {
              $scope.machines = [];
              $scope.macsInputOptions = [];
              data.data.forEach(function (item) {
                if (item.health) {
                  $scope.macsInputOptions.push({
                    text: item.ip + ':' + item.port,
                    value: item.ip + ':' + item.port
                  });
                }
              });
            }
            if ($scope.macsInputOptions.length > 0) {
              $scope.macInputModel = $scope.macsInputOptions[0].value;
            }
          } else {
            $scope.macsInputOptions = [];
          }
        }
      );
    };
    $scope.$watch('macInputModel', function () {
      if ($scope.macInputModel) {
        getMachineRules();
      }
    });
  }]);