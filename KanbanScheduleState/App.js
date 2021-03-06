Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [
        {
            xtype: 'container',
            itemId: 'gridContainer',
            columnWidth: 1
        },
        {
            xtype: 'container',
            itemId: 'queryContainer'
        }
    ],

    _firstArtifactStore: null,
    _secondArtifactStore: null,
    _filteredArtifactRecords: [],
    _queryContainer: null,
    _artifactGrid: null,
    _kanbanFieldDisplayName: 'c_KanbanScheduleState',
    _validationStateName: "Validation",

    // Context
    _currentUser: null,
    _currentWorkspaceRef: null,
    _currentProjectRef: null,
    _currentProjectScopeUp: null,
    _currentProjectScopeDown: null,

    launch: function() {
        this._getArtifacts();
    },

    _getArtifacts: function() {

        var me = this;
        var queryFilter = '((KanbanScheduleState = "") OR ((KanbanScheduleState != ScheduleState) AND (KanbanScheduleState != "' + me._validationStateName + '")))';

        var currentContext = this.getContext();

        me._currentUser = currentContext.getUser();
        me._currentWorkspaceRef = currentContext.getWorkspaceRef();
        me._currentProjectRef = currentContext.getProjectRef();
        me._currentProjectScopeUp = currentContext.getProjectScopeUp();
        me._currentProjectScopeDown = currentContext.getProjectScopeDown();

        this._queryContainer = this.down('#queryContainer').add({
            xtype: 'container',
            html: "Showing Stories matching the following Query:<br/>" + queryFilter.toString()
        });

        this._firstArtifactStore = Ext.create('Rally.data.wsapi.artifact.Store', {
            models: ['UserStory', 'Defect'],
            fetch: ['ObjectID', 'FormattedID', 'Name', 'Owner', 'ScheduleState', me._kanbanFieldDisplayName],
            autoLoad: true,
            limit: Infinity,
            context: {
                projectScopeUp: me._currentProjectScopeUp,
                projectScopeDown: me._currentProjectScopeDown,
                workspace: me._currentWorkspaceRef,
                project: me._currentProjectRef
            },
            listeners: {
                scope: this,
                load: me._firstArtifactStoreLoaded
            },
            filters: [
                {
                    property: me._kanbanFieldDisplayName,
                    operator: '=',
                    value: ""
                }
            ]
        });
    },

    _firstArtifactStoreLoaded: function(store, records) {
        var me = this;

        me._filteredArtifactRecords = records;

        me._secondArtifactStore = Ext.create('Rally.data.wsapi.artifact.Store', {
            models: ['UserStory', 'Defect'],
            fetch: ['ObjectID', 'FormattedID', 'Name', 'Owner', 'ScheduleState', me._kanbanFieldDisplayName],
            autoLoad: true,
            limit: Infinity,
            context: {
                projectScopeUp: me._currentProjectScopeUp,
                projectScopeDown: me._currentProjectScopeDown,
                workspace: me._currentWorkspaceRef,
                project: me._currentProjectRef
            },
            listeners: {
                scope: this,
                load: me._secondArtifactStoreLoaded
            },
            filters: [
                {
                    property: me._kanbanFieldDisplayName,
                    operator: '!=',
                    value: ""
                }
            ]
        });

    },

    _secondArtifactStoreLoaded: function(store, records) {

        var me = this;

        Ext.Array.each(records, function(record) {
            var thisKanbanScheduleState = record.get(me._kanbanFieldDisplayName);
            var thisScheduleState = record.get('ScheduleState');
            if ( (thisKanbanScheduleState != thisScheduleState) && (thisKanbanScheduleState != me._validationStateName) ) {
                me._filteredArtifactRecords.push(record);
            }
        });

        me._makeGrid();

    },

    _makeGrid: function() {

        var me = this;

        if (me._artifactGrid) {
            me._artifactGrid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: me._filteredArtifactRecords,
            pageSize: 50,
            remoteSort: false,
            groupField: me._kanbanFieldDisplayName
        });

        me._artifactGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,
            features: [
                {
                    ftype:'groupingsummary',
                    startCollapsed: false
                }
            ],
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'Owner', dataIndex: 'Owner',
                    renderer: function(value) {
                        if (value) {
                            return value._refObjectName;
                        } else {
                            return "No Owner";
                        }
                    },
                    flex: 1
                },
                {
                    text: 'ScheduleState', dataIndex: 'ScheduleState', flex: 1
                },
                {
                    text: 'KanbanScheduleState', dataIndex: me._kanbanFieldDisplayName, flex: 1
                }
            ]
        });

        me.down('#gridContainer').add(me._artifactGrid);
        me._artifactGrid.reconfigure(gridStore);
    }

});