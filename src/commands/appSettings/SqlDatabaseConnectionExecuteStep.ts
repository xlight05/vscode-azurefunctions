/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { ConnectionKey, ConnectionType } from '../../constants';
import { getLocalConnectionString, MismatchBehavior, setLocalAppSetting } from '../../funcConfig/local.settings';
import { getSqlDatabaseConnectionString } from '../../utils/azure';
import { ISqlDatabaseConnectionWizardContext } from './ISqlDatabaseConnectionWizardContext';

export class SqlDatabaseConnectionExecuteStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 240;

    public constructor(private _saveAsProcessEnvVariable?: boolean) {
        super();
    }

    public async execute(context: T): Promise<void> {
        const value: string = (await getSqlDatabaseConnectionString(context)).connectionString;

        const currentSqlConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.SQL, context.projectPath);
        if (!currentSqlConnection || !this._saveAsProcessEnvVariable) {
            await setLocalAppSetting(context, context.projectPath, ConnectionKey.SQL, value, MismatchBehavior.Overwrite);
        } else {
            process.env[ConnectionKey.SQL] = value;
        }
    }

    public shouldExecute(context: T): boolean {
        return !!context.sqlDbConnectionType && context.sqlDbConnectionType !== ConnectionType.Skip;
    }
}
