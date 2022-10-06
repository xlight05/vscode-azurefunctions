/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType, localEventHubEmulatorConnectionString } from '../../constants';
import { eventHubsConnectionKey, MismatchBehavior, setLocalAppSetting } from '../../funcConfig/local.settings';
import { getEventHubsConnectionString } from '../../utils/azure';
import { IAzureWebJobsStorageWizardContext } from './IAzureWebJobsStorageWizardContext';
import { IEventHubsConnectionWizardContext } from './IEventHubsConnectionWizardContext';

export class EventHubsConnectionExecuteStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 210;

    public async execute(context: IEventHubsConnectionWizardContext): Promise<void> {
        let value: string;
        if (context.eventHubConnectionType === ConnectionType.Emulator) {
            value = localEventHubEmulatorConnectionString;
        } else {
            value = (await getEventHubsConnectionString(context)).connectionString;
        }

        await setLocalAppSetting(context, context.projectPath, eventHubsConnectionKey, value, MismatchBehavior.Overwrite);
    }

    public shouldExecute(context: IAzureWebJobsStorageWizardContext): boolean {
        return !!context.azureWebJobsStorageType;
    }
}
