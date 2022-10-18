/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Database, SqlManagementClient } from '@azure/arm-sql';
import { ext } from '@microsoft/vscode-azext-azureappservice/out/src/extensionVariables';
import { ILocationWizardContext, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, ISubscriptionContext, nonNullValue } from '@microsoft/vscode-azext-utils';
import { Progress } from 'vscode';
import { ConnectionType } from '../../../../constants';
import { localize } from '../../../../localize';
import { createSqlClient } from '../../../../utils/azureClients';
import { ISqlDatabaseConnectionWizardContext } from '../../../appSettings/ISqlDatabaseConnectionWizardContext';

export class SqlDatabaseCreateStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 210;

    public async execute(context: T & ISubscriptionContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const client: SqlManagementClient = await createSqlClient(<T & ISubscriptionContext>context);
        const rgName: string = nonNullValue(context.resourceGroup?.name);
        const serverName: string = nonNullValue(context.sqlServer?.name);
        const newDatabaseName: string = nonNullValue(context.newSqlDatabaseName);

        const creating: string = localize('creatingSqlServer', 'Creating new SQL database "{0}"...', newDatabaseName);
        const created: string = localize('createdSqlServer', 'Created new SQL database "{0}"...', newDatabaseName);
        ext.outputChannel.appendLog(creating);
        progress.report({ message: creating });

        const dbParams: Database = {
            sku: {
                name: 'GP_S_Gen5',
                tier: 'GeneralPurpose',
                family: 'Gen5',
                capacity: 1
            },
            location: (await LocationListStep.getLocation(<ILocationWizardContext>context)).name,
        };

        context.sqlDatabase = await client.databases.beginCreateOrUpdateAndWait(rgName, serverName, newDatabaseName, dbParams);
        ext.outputChannel.appendLog(created);
    }

    public shouldExecute(context: T): boolean {
        return !!context.resourceGroup && !!context.newSqlDatabaseName && LocationListStep.hasLocation(<ILocationWizardContext>context) && context.sqlDbConnectionType === ConnectionType.Azure;
    }
}
