/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageAccountWizardContext } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { ConnectionKey, ConnectionType, localStorageEmulatorConnectionString } from '../../constants';
import { getLocalConnectionString, MismatchBehavior, setLocalAppSetting } from '../../funcConfig/local.settings';
import { getStorageConnectionString } from '../../utils/azure';
import { IAzureWebJobsStorageWizardContext } from './IAzureWebJobsStorageWizardContext';

export class AzureWebJobsStorageExecuteStep<T extends IAzureWebJobsStorageWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 230;

    public constructor(private _saveAsProcessEnvVariable?: boolean) {
        super();
    }

    public async execute(context: IAzureWebJobsStorageWizardContext): Promise<void> {
        let value: string;
        if (context.azureWebJobsStorageType === ConnectionType.Emulator) {
            value = localStorageEmulatorConnectionString;
        } else {
            value = (await getStorageConnectionString(<IStorageAccountWizardContext>context)).connectionString;
        }

        const currentAzureStorageConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.Storage, context.projectPath);
        if (!currentAzureStorageConnection || !this._saveAsProcessEnvVariable) {
            await setLocalAppSetting(context, context.projectPath, ConnectionKey.Storage, value, MismatchBehavior.Overwrite);
        } else {
            process.env[ConnectionKey.Storage] = value;
        }
    }

    public shouldExecute(context: IAzureWebJobsStorageWizardContext): boolean {
        return !!context.azureWebJobsStorageType && context.azureWebJobsStorageType !== ConnectionType.Skip;
    }
}
