/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Database, Server, SqlManagementClient } from '@azure/arm-sql';
import { uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionContext, IWizardOptions, nonNullProp, nonNullValue } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../../../constants';
import { localize } from '../../../../localize';
import { createSqlClient } from '../../../../utils/azureClients';
import { ISqlDatabaseConnectionWizardContext } from '../../../appSettings/ISqlDatabaseConnectionWizardContext';
import { SqlDatabaseCreateStep } from './SqlDatabaseCreateStep';
import { SqlDatabaseNameStep } from './SqlDatabaseNameStep';

export class SqlDatabaseListStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        const client: SqlManagementClient = await createSqlClient(<T & ISubscriptionContext>context);
        const rgName: string = nonNullValue(context.resourceGroup?.name);
        const serverName: string = nonNullValue(context.sqlServer?.name);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a SQL database.' };
        const picksTask: Promise<IAzureQuickPickItem<Database | undefined>[]> = this.getQuickPicks(uiUtils.listAllIterator(client.databases.listByServer(rgName, serverName)));

        const result: Database | undefined = (await context.ui.showQuickPick(picksTask, quickPickOptions)).data;
        context.sqlDatabase = result;
    }

    public async getSubWizard(context: T): Promise<IWizardOptions<T> | undefined> {
        const promptSteps: AzureWizardPromptStep<T & ISubscriptionContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<T & ISubscriptionContext>[] = [];

        if (context.sqlDatabase) {
            context.valuesToMask.push(nonNullProp(context.sqlDatabase, 'name'));
        } else {
            promptSteps.push(new SqlDatabaseNameStep());
            executeSteps.push(new SqlDatabaseCreateStep());
        }

        return { promptSteps, executeSteps };
    }

    public shouldPrompt(context: T): boolean {
        return !context.sqlDatabase && !!context.resourceGroup && !!context.sqlServer && context.sqlDbConnectionType === ConnectionType.Azure;
    }

    private async getQuickPicks(dbTask: Promise<Server[]>): Promise<IAzureQuickPickItem<Database | undefined>[]> {
        const picks: IAzureQuickPickItem<Server | undefined>[] = [{
            label: localize('newSqlDatabase', '$(plus) Create new SQL database'),
            description: '',
            data: undefined
        }];

        const dbs: Database[] = await dbTask;
        for (const db of dbs) {
            picks.push({
                id: db.id,
                label: db.name!,
                description: '',
                data: db
            });
        }

        return picks;
    }
}
