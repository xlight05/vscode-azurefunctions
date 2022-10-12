/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../constants';
import { ISqlDatabaseConnectionWizardContext } from './ISqlDatabaseConnectionWizardContext';

export class SqlDatabaseConnectionExecuteStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 230;

    public constructor(private _saveAsProcessEnvVariable?: boolean) {
        super();
    }

    public async execute(_context: T): Promise<void> {
        console.log(this._saveAsProcessEnvVariable);
        // const value: string = (await getStorageConnectionString(<IStorageAccountWizardContext>context)).connectionString;

        // const currentAzureStorageConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.Storage, context.projectPath);
        // if (!currentAzureStorageConnection || !this._saveAsProcessEnvVariable) {
        //     await setLocalAppSetting(context, context.projectPath, ConnectionKey.Storage, value, MismatchBehavior.Overwrite);
        // } else {
        //     process.env[ConnectionKey.Storage] = value;
        // }
    }

    public shouldExecute(context: T): boolean {
        return !!context.sqlDbConnectionType && context.sqlDbConnectionType !== ConnectionType.Skip;
    }
}
