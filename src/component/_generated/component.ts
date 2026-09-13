/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      checkAndRecordEvent: FunctionReference<
        "mutation",
        "internal",
        { eventId: string; eventType: string; payload: string },
        { alreadyProcessed: boolean },
        Name
      >;
      getEgress: FunctionReference<
        "query",
        "internal",
        { egressId: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          egressId: string;
          endedAt?: number;
          error?: string;
          roomName?: string;
          startedAt?: number;
          status: string;
          updatedAt: number;
        },
        Name
      >;
      getRoom: FunctionReference<
        "query",
        "internal",
        { name: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          emptyTimeout?: number;
          endedAt?: number;
          maxParticipants?: number;
          metadata?: string;
          name: string;
          numParticipants?: number;
          sid?: string;
          startedAt?: number;
          status: "started" | "finished";
          updatedAt: number;
        },
        Name
      >;
      getStats: FunctionReference<
        "query",
        "internal",
        {},
        {
          egressCount: number;
          liveRoomCount: number;
          participantCount: number;
          roomCount: number;
          webhookEventCount: number;
        },
        Name
      >;
      listEgressByRoom: FunctionReference<
        "query",
        "internal",
        { limit?: number; roomName: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          egressId: string;
          endedAt?: number;
          error?: string;
          roomName?: string;
          startedAt?: number;
          status: string;
          updatedAt: number;
        }>,
        Name
      >;
      listParticipantsByRoom: FunctionReference<
        "query",
        "internal",
        { limit?: number; roomName: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          identity: string;
          joinedAt?: number;
          leftAt?: number;
          metadata?: string;
          name?: string;
          participantSid: string;
          roomName: string;
          state: "joined" | "left";
          updatedAt: number;
        }>,
        Name
      >;
      listRecentEgress: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          egressId: string;
          endedAt?: number;
          error?: string;
          roomName?: string;
          startedAt?: number;
          status: string;
          updatedAt: number;
        }>,
        Name
      >;
      listRecentParticipants: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          identity: string;
          joinedAt?: number;
          leftAt?: number;
          metadata?: string;
          name?: string;
          participantSid: string;
          roomName: string;
          state: "joined" | "left";
          updatedAt: number;
        }>,
        Name
      >;
      listRecentWebhookEvents: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          eventId: string;
          eventType: string;
          payload: string;
          receivedAt: number;
        }>,
        Name
      >;
      listRooms: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          emptyTimeout?: number;
          endedAt?: number;
          maxParticipants?: number;
          metadata?: string;
          name: string;
          numParticipants?: number;
          sid?: string;
          startedAt?: number;
          status: "started" | "finished";
          updatedAt: number;
        }>,
        Name
      >;
      markParticipantLeftByIdentity: FunctionReference<
        "mutation",
        "internal",
        { identity: string; roomName: string },
        null,
        Name
      >;
      markRoomFinished: FunctionReference<
        "mutation",
        "internal",
        { endedAt?: number; name: string },
        null,
        Name
      >;
      patchRoomMetadata: FunctionReference<
        "mutation",
        "internal",
        { metadata: string; name: string },
        null,
        Name
      >;
      patchRoomParticipantCount: FunctionReference<
        "mutation",
        "internal",
        { name: string; numParticipants: number },
        null,
        Name
      >;
      recordEgress: FunctionReference<
        "mutation",
        "internal",
        {
          egressId: string;
          endedAt?: number;
          error?: string;
          roomName?: string;
          startedAt?: number;
          status: string;
        },
        string,
        Name
      >;
      recordParticipant: FunctionReference<
        "mutation",
        "internal",
        {
          identity: string;
          joinedAt?: number;
          leftAt?: number;
          metadata?: string;
          name?: string;
          participantSid: string;
          roomName: string;
          state: "joined" | "left";
        },
        string,
        Name
      >;
      recordRoom: FunctionReference<
        "mutation",
        "internal",
        {
          emptyTimeout?: number;
          endedAt?: number;
          maxParticipants?: number;
          metadata?: string;
          name: string;
          numParticipants?: number;
          sid?: string;
          startedAt?: number;
          status: "started" | "finished";
        },
        string,
        Name
      >;
    };
  };
