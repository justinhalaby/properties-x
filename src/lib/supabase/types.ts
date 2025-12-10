import type { Property } from "@/types/property";
import type { PropertyEvaluation, PropertyEvaluationInsert } from "@/types/property-evaluation";
import type { MontrealEvaluationDetails, MontrealEvaluationInsert } from "@/types/montreal-evaluation";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: Property;
        Insert: Omit<Property, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Property, "id" | "created_at" | "updated_at">>;
      };
      property_evaluations: {
        Row: PropertyEvaluation;
        Insert: PropertyEvaluationInsert;
        Update: Partial<PropertyEvaluationInsert>;
      };
      montreal_evaluation_details: {
        Row: MontrealEvaluationDetails;
        Insert: MontrealEvaluationInsert;
        Update: Partial<MontrealEvaluationInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
