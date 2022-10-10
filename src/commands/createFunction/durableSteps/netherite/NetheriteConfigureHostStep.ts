/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from '@microsoft/vscode-azext-azureappservice/out/src/extensionVariables';
import { AzExtFsExtra, AzureWizardExecuteStep, nonNullValue } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { hostFileName, hostJsonConfigFailed } from '../../../../constants';
import { IHostJsonV2, INetheriteTaskJson } from '../../../../funcConfig/host';
import { durableUtils } from '../../../../utils/durableUtils';
import { IEventHubsConnectionWizardContext } from '../../../appSettings/IEventHubsConnectionWizardContext';

export class NetheriteConfigureHostStep<T extends IEventHubsConnectionWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 250;

    public async execute(context: T): Promise<void> {
        try {
            const hostJsonPath: string = path.join(context.projectPath, hostFileName);
            const hostJson: IHostJsonV2 = await AzExtFsExtra.readJSON(hostJsonPath) as IHostJsonV2;

            const durableTask = hostJson.extensions?.durableTask as INetheriteTaskJson ?? {};
            const existingHubName: string | undefined = durableTask?.hubName;
            const existingPartitionCount: number | undefined = durableTask?.storageProvider?.partitionCount;

            hostJson.extensions ??= {};
            hostJson.extensions.durableTask = durableUtils.getDefaultNetheriteTaskConfig(
                nonNullValue(context.newEventHubName || existingHubName),
                nonNullValue(context.partitionCount || existingPartitionCount)
            );

            await AzExtFsExtra.writeJSON(hostJsonPath, hostJson);
        } catch {
            ext.outputChannel.appendLog(hostJsonConfigFailed);
        }
    }

    public shouldExecute(context: T): boolean {
        return !!context.newEventHubName || !!context.partitionCount;
    }
}
